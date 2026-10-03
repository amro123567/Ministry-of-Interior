package com.moi.cts.service;

import com.moi.cts.dto.DocumentReviewDtos.*;
import com.moi.cts.entity.*;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.DocumentRepository;
import com.moi.cts.repository.DocumentValidationRepository;
import com.moi.cts.repository.PhysicalDocumentHandlingRepository;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Document validation sign-offs (FR-11) and the physical chain of custody (FR-11).
 * Both are tracked independently of the document's digital record: validating or moving
 * the paper original never edits the {@link Document} row.
 */
@Service
public class DocumentReviewService {

    private final DocumentRepository documentRepository;
    private final DocumentValidationRepository validationRepository;
    private final PhysicalDocumentHandlingRepository handlingRepository;
    private final AppUserRepository userRepository;
    private final AuditService auditService;

    public DocumentReviewService(DocumentRepository documentRepository,
                                 DocumentValidationRepository validationRepository,
                                 PhysicalDocumentHandlingRepository handlingRepository,
                                 AppUserRepository userRepository, AuditService auditService) {
        this.documentRepository = documentRepository;
        this.validationRepository = validationRepository;
        this.handlingRepository = handlingRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public DocumentReviewDto review(Long documentId) {
        findDocument(documentId);
        List<DocumentValidation> validations =
                validationRepository.findByDocumentIdOrderByValidatedAtDescIdDesc(documentId);
        String status = validations.isEmpty() ? "PENDING" : validations.get(0).getDecision().name();
        return new DocumentReviewDto(documentId, status,
                validations.stream().map(this::toDto).toList(),
                handlingRepository.findByDocumentIdOrderByHandledAtAscIdAsc(documentId).stream()
                        .map(this::toDto).toList());
    }

    @Transactional
    public ValidationDto validate(Long documentId, ValidateDocumentRequest request, AppUserPrincipal actor) {
        Document document = findDocument(documentId);
        AppUser user = loadUser(actor);
        ValidationDecision decision = parse(ValidationDecision.class, request.decision(), "decision");
        // Segregation of duties: whoever issued the document cannot sign it off.
        if (document.getCreatedBy() != null && document.getCreatedBy().getId().equals(user.getId())) {
            throw new BadRequestException("You cannot validate a document you issued yourself.");
        }
        String comment = request.comment() == null ? null : request.comment().trim();
        if (decision == ValidationDecision.REJECTED && (comment == null || comment.isEmpty())) {
            throw new BadRequestException("A rejection comment is required.");
        }
        DocumentValidation validation = new DocumentValidation();
        validation.setDocument(document);
        validation.setValidator(user);
        validation.setDecision(decision);
        validation.setComment(comment);
        validation = validationRepository.save(validation);
        auditService.log("Document", documentId, "VALIDATION_" + decision.name(), user,
                comment == null ? "Document " + decision.name().toLowerCase() : comment);
        return toDto(validation);
    }

    @Transactional
    public CustodyEventDto recordCustody(Long documentId, RecordCustodyRequest request, AppUserPrincipal actor) {
        Document document = findDocument(documentId);
        AppUser user = loadUser(actor);
        CustodyEventType type = parse(CustodyEventType.class, request.eventType(), "eventType");
        List<PhysicalDocumentHandling> existing =
                handlingRepository.findByDocumentIdOrderByHandledAtAscIdAsc(documentId);
        if (existing.isEmpty() && type != CustodyEventType.RECEIVED) {
            throw new BadRequestException("The first custody event must be RECEIVED.");
        }
        PhysicalDocumentHandling event = new PhysicalDocumentHandling();
        event.setDocument(document);
        event.setEventType(type);
        event.setLocation(request.location().trim());
        event.setNote(request.note() == null ? null : request.note().trim());
        event.setHandledBy(user);
        event.setHandledByNameSnapshot(user.getFullName());
        event.setHandledByRoleSnapshot(roleSnapshot(actor));
        event = handlingRepository.save(event);
        auditService.log("Document", documentId, "CUSTODY_" + type.name(), user,
                type.name() + " at " + event.getLocation());
        return toDto(event);
    }

    // ---- helpers -----------------------------------------------------------

    private Document findDocument(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Document not found: " + id));
    }

    private AppUser loadUser(AppUserPrincipal actor) {
        return userRepository.findById(actor.getId())
                .orElseThrow(() -> new NotFoundException("User not found: " + actor.getId()));
    }

    private static String roleSnapshot(AppUserPrincipal actor) {
        String roles = actor.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith("ROLE_")).map(a -> a.substring(5)).sorted()
                .collect(Collectors.joining(","));
        return roles.isEmpty() ? "UNKNOWN" : roles;
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value, String field) {
        try {
            return Enum.valueOf(type, value.trim().toUpperCase());
        } catch (Exception e) {
            throw new BadRequestException("Unknown " + field + ": " + value);
        }
    }

    private ValidationDto toDto(DocumentValidation v) {
        return new ValidationDto(v.getId(), v.getDecision().name(), v.getComment(),
                v.getValidator().getFullName(), v.getValidatedAt());
    }

    private CustodyEventDto toDto(PhysicalDocumentHandling h) {
        return new CustodyEventDto(h.getId(), h.getEventType().name(), h.getLocation(), h.getNote(),
                h.getHandledByNameSnapshot(), h.getHandledByRoleSnapshot(), h.getHandledAt());
    }
}
