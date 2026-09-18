package com.moi.cts.service;

import com.moi.cts.dto.RequestDtos.*;
import com.moi.cts.entity.*;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.IllegalTransitionException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.*;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;

/**
 * Owns the correspondence workflow. The legal-transition check here is the
 * Spring-side replacement for the SQLite/MySQL trg_request_legal_transition
 * trigger and the trg_request_sla_close trigger: both are service-layer
 * logic now instead of database triggers, which is the tradeoff this
 * rewrite makes deliberately (see README "What changed and why").
 */
@Service
public class RequestService {

    private final CorrespondenceRequestRepository requestRepository;
    private final CitizenRepository citizenRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final OfficeRepository officeRepository;
    private final AppUserRepository userRepository;
    private final RequestStateHistoryRepository historyRepository;
    private final WorkflowTransitionRuleRepository transitionRuleRepository;
    private final NotificationRepository notificationRepository;
    private final AuditService auditService;

    public RequestService(CorrespondenceRequestRepository requestRepository, CitizenRepository citizenRepository,
                           DocumentTypeRepository documentTypeRepository, OfficeRepository officeRepository,
                           AppUserRepository userRepository, RequestStateHistoryRepository historyRepository,
                           WorkflowTransitionRuleRepository transitionRuleRepository,
                           NotificationRepository notificationRepository, AuditService auditService) {
        this.requestRepository = requestRepository;
        this.citizenRepository = citizenRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.officeRepository = officeRepository;
        this.userRepository = userRepository;
        this.historyRepository = historyRepository;
        this.transitionRuleRepository = transitionRuleRepository;
        this.notificationRepository = notificationRepository;
        this.auditService = auditService;
    }

    public List<RequestSummaryDto> list(String status, String search) {
        Specification<CorrespondenceRequest> spec = Specification.where(null);
        if (status != null && !status.isBlank()) {
            RequestStatus s = parseStatus(status);
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), s));
        }
        if (search != null && !search.isBlank()) {
            String like = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
            spec = spec.and((root, q, cb) -> cb.or(
                    cb.like(cb.lower(root.get("referenceNumber")), like),
                    cb.like(cb.lower(root.join("citizen").get("firstNameEn")), like),
                    cb.like(cb.lower(root.join("citizen").get("lastNameEn")), like),
                    cb.like(root.join("citizen").get("registryNumber"), like)));
        }
        return requestRepository.findAll(spec).stream().map(this::toSummary).toList();
    }

    public RequestDetailDto get(Long id) {
        return toDetail(find(id));
    }

    public List<HistoryDto> history(Long id) {
        find(id);
        return historyRepository.findByRequestIdOrderByChangedAtAsc(id).stream()
                .map(h -> new HistoryDto(h.getId(),
                        h.getFromStatus() != null ? h.getFromStatus().name() : null,
                        h.getToStatus().name(), h.getChangedBy().getFullName(), h.getNote(), h.getChangedAt()))
                .toList();
    }

    @Transactional
    public RequestDetailDto create(CreateRequestRequest request, AppUserPrincipal actor) {
        Citizen citizen = citizenRepository.findById(request.citizenId())
                .orElseThrow(() -> new NotFoundException("Citizen not found: " + request.citizenId()));
        DocumentType docType = documentTypeRepository.findById(request.documentTypeId())
                .orElseThrow(() -> new NotFoundException("Document type not found: " + request.documentTypeId()));
        Office office = officeRepository.findById(request.officeId())
                .orElseThrow(() -> new NotFoundException("Office not found: " + request.officeId()));
        AppUser createdBy = currentUser(actor);

        CorrespondenceRequest req = new CorrespondenceRequest();
        req.setReferenceNumber(generateReferenceNumber());
        req.setCitizen(citizen);
        req.setDocumentType(docType);
        req.setOffice(office);
        req.setCreatedBy(createdBy);
        req.setStatus(RequestStatus.DRAFT);
        req.setPriority(request.priority() != null ? request.priority() : "NORMAL");
        req.setNotes(request.notes());
        req.setDueAt(Instant.now().plus(docType.getSlaDays(), ChronoUnit.DAYS));
        req = requestRepository.save(req);

        recordHistory(req, null, RequestStatus.DRAFT, createdBy, "Created");
        auditService.log("CorrespondenceRequest", req.getId(), "CREATE", createdBy,
                "reference=" + req.getReferenceNumber());
        return toDetail(req);
    }

    @Transactional
    public RequestDetailDto assign(Long id, AssignRequest request, AppUserPrincipal actor) {
        // Assignment is a field on the request, independent of its workflow
        // status -- a request can be pre-assigned while still DRAFT, or
        // reassigned later. Status changes go through transition() only,
        // which is where the legal-transition matrix is enforced.
        CorrespondenceRequest req = find(id);
        AppUser assignee = userRepository.findById(request.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + request.userId()));
        req.setAssignedTo(assignee);
        requestRepository.save(req);

        Notification n = new Notification();
        n.setRecipient(assignee);
        n.setRelatedRequest(req);
        n.setMessage("You were assigned request " + req.getReferenceNumber());
        notificationRepository.save(n);

        auditService.log("CorrespondenceRequest", req.getId(), "ASSIGN", currentUser(actor),
                "assignedTo=" + assignee.getUsername());
        return toDetail(req);
    }

    @Transactional
    public RequestDetailDto transition(Long id, TransitionRequest request, AppUserPrincipal actor) {
        CorrespondenceRequest req = find(id);
        RequestStatus from = req.getStatus();
        RequestStatus to = parseStatus(request.toStatus());

        WorkflowTransitionRule rule = transitionRuleRepository.findByFromStatusAndToStatus(from, to)
                .orElseThrow(() -> new IllegalTransitionException(
                        "Cannot move a request from " + from + " to " + to + "."));

        boolean actorHasRole = actor.getUser().getRoles().stream()
                .anyMatch(r -> r.getName() == rule.getRequiredRole() || r.getName() == RoleName.ADMIN);
        if (!actorHasRole) {
            throw new IllegalTransitionException(
                    "This transition requires the " + rule.getRequiredRole() + " role.");
        }

        if (to == RequestStatus.REJECTED
                && (request.rejectionReason() == null || request.rejectionReason().isBlank())) {
            throw new BadRequestException("A rejection reason is required.");
        }

        AppUser actorUser = currentUser(actor);
        req.setStatus(to);
        if (to == RequestStatus.SUBMITTED) req.setSubmittedAt(Instant.now());
        if (to == RequestStatus.REJECTED) req.setRejectionReason(request.rejectionReason());
        if (to == RequestStatus.APPROVED || to == RequestStatus.REJECTED || to == RequestStatus.ARCHIVED) {
            req.setClosedAt(Instant.now());
        }
        requestRepository.save(req);
        recordHistory(req, from, to, actorUser, request.note());
        auditService.log("CorrespondenceRequest", req.getId(), "TRANSITION",
                actorUser, from + " -> " + to);
        return toDetail(req);
    }

    private void recordHistory(CorrespondenceRequest req, RequestStatus from, RequestStatus to,
                                AppUser actor, String note) {
        RequestStateHistory h = new RequestStateHistory();
        h.setRequest(req);
        h.setFromStatus(from);
        h.setToStatus(to);
        h.setChangedBy(actor);
        h.setNote(note);
        historyRepository.save(h);
    }

    private CorrespondenceRequest find(Long id) {
        return requestRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Request not found: " + id));
    }

    private AppUser currentUser(AppUserPrincipal principal) {
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new NotFoundException("Authenticated user vanished: " + principal.getId()));
    }

    private RequestStatus parseStatus(String raw) {
        try {
            return RequestStatus.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown status: " + raw);
        }
    }

    private String generateReferenceNumber() {
        return "CTS-" + Instant.now().toEpochMilli();
    }

    private RequestSummaryDto toSummary(CorrespondenceRequest r) {
        return new RequestSummaryDto(r.getId(), r.getReferenceNumber(),
                r.getCitizen().getFirstNameEn() + " " + safe(r.getCitizen().getLastNameEn()),
                r.getDocumentType().getNameEn(), r.getStatus().name(), r.getPriority(),
                r.getAssignedTo() != null ? r.getAssignedTo().getFullName() : null,
                r.getDueAt(), r.isOverdue(), r.getCreatedAt());
    }

    RequestDetailDto toDetail(CorrespondenceRequest r) {
        var citizenDto = new com.moi.cts.dto.CitizenDtos.CitizenDto(
                r.getCitizen().getId(), r.getCitizen().getRegistryNumber(), r.getCitizen().getFirstNameEn(),
                r.getCitizen().getLastNameEn(), r.getCitizen().getFirstNameAr(), r.getCitizen().getLastNameAr(),
                r.getCitizen().getDateOfBirth(), r.getCitizen().getGender(),
                r.getCitizen().getRegisteredOffice() != null ? r.getCitizen().getRegisteredOffice().getNameEn() : null);
        var docTypeDto = new com.moi.cts.dto.ReferenceDtos.DocumentTypeDto(
                r.getDocumentType().getId(), r.getDocumentType().getCode(), r.getDocumentType().getNameEn(),
                r.getDocumentType().getNameAr(), r.getDocumentType().getSlaDays());
        var officeDto = new com.moi.cts.dto.ReferenceDtos.OfficeDto(
                r.getOffice().getId(), r.getOffice().getCode(), r.getOffice().getNameEn(), r.getOffice().getNameAr());

        return new RequestDetailDto(r.getId(), r.getReferenceNumber(), citizenDto, docTypeDto, officeDto,
                r.getAssignedTo() != null ? r.getAssignedTo().getFullName() : null,
                r.getAssignedTo() != null ? r.getAssignedTo().getId() : null,
                r.getCreatedBy().getFullName(), r.getStatus().name(), r.getPriority(), r.getNotes(),
                r.getRejectionReason(), r.getCreatedAt(), r.getSubmittedAt(), r.getDueAt(), r.getClosedAt(),
                r.isOverdue());
    }

    private String safe(String s) { return s == null ? "" : s; }

    List<CorrespondenceRequest> rawList(String status, String search) {
        Specification<CorrespondenceRequest> spec = Specification.where(null);
        if (status != null && !status.isBlank()) {
            spec = spec.and((root, q, cb) -> cb.equal(root.get("status"), parseStatus(status)));
        }
        return requestRepository.findAll(spec);
    }
}
