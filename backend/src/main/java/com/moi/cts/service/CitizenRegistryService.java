package com.moi.cts.service;

import com.moi.cts.dto.CitizenRegistryDtos.*;
import com.moi.cts.entity.*;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.*;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Family records/membership, guardianship, registry transfers, and civil-
 * status amendments (ERD domain 5, minus {@code citizens} itself, which
 * {@link CitizenService} already owned). Implements the service-layer
 * invariants the schema itself can't express (SI-11, SI-12 here; SI-1/
 * SI-3/SI-4 live in CitizenService, next to the lineage fields they
 * govern).
 */
@Service
public class CitizenRegistryService {

    private final FamilyRecordRepository familyRecordRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final GuardianshipRecordRepository guardianshipRepository;
    private final RegistryTransferRepository transferRepository;
    private final CivilStatusAmendmentRepository amendmentRepository;
    private final CitizenRepository citizenRepository;
    private final OfficeRepository officeRepository;
    private final CourtRepository courtRepository;
    private final AppUserRepository userRepository;
    private final CitizenAuditService citizenAuditService;

    public CitizenRegistryService(FamilyRecordRepository familyRecordRepository,
                                   FamilyMemberRepository familyMemberRepository,
                                   GuardianshipRecordRepository guardianshipRepository,
                                   RegistryTransferRepository transferRepository,
                                   CivilStatusAmendmentRepository amendmentRepository,
                                   CitizenRepository citizenRepository, OfficeRepository officeRepository,
                                   CourtRepository courtRepository, AppUserRepository userRepository,
                                   CitizenAuditService citizenAuditService) {
        this.familyRecordRepository = familyRecordRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.guardianshipRepository = guardianshipRepository;
        this.transferRepository = transferRepository;
        this.amendmentRepository = amendmentRepository;
        this.citizenRepository = citizenRepository;
        this.officeRepository = officeRepository;
        this.courtRepository = courtRepository;
        this.userRepository = userRepository;
        this.citizenAuditService = citizenAuditService;
    }

    // ==== family records / membership ====================================

    @Transactional
    public FamilyRecordDto createFamilyRecord(CreateFamilyRecordRequest request, AppUserPrincipal actor) {
        Citizen head = findCitizen(request.headOfHouseholdId());
        FamilyRecord record = new FamilyRecord();
        record.setFamilyBookNumber(request.familyBookNumber());
        record.setHeadOfHousehold(head);
        if (request.registrationOfficeId() != null) {
            record.setRegistrationOffice(findOffice(request.registrationOfficeId()));
        }
        record.setCreatedBy(currentUser(actor));
        record = familyRecordRepository.save(record);

        // The head of household is a member of their own family record from
        // the day it's opened -- this isn't optional data entry, it's what
        // "head of household" means.
        FamilyMember headMembership = new FamilyMember();
        headMembership.setFamilyRecord(record);
        headMembership.setCitizen(head);
        headMembership.setRelationship(FamilyRelationship.HEAD);
        headMembership.setJoinedDate(LocalDate.now());
        familyMemberRepository.save(headMembership);

        return toDto(record);
    }

    public FamilyRecordDto getFamilyRecord(Long id) {
        return toDto(findFamilyRecord(id));
    }

    @Transactional
    public FamilyMemberDto addFamilyMember(Long familyRecordId, AddFamilyMemberRequest request) {
        FamilyRecord record = findFamilyRecord(familyRecordId);
        Citizen citizen = findCitizen(request.citizenId());
        if (!familyMemberRepository.findByFamilyRecordIdAndCitizenIdAndLeftDateIsNull(familyRecordId, citizen.getId())
                .isEmpty()) {
            throw new BadRequestException("This citizen is already an active member of this family record.");
        }
        FamilyMember member = new FamilyMember();
        member.setFamilyRecord(record);
        member.setCitizen(citizen);
        member.setRelationship(parseRelationship(request.relationship()));
        member.setJoinedDate(request.joinedDate() != null ? request.joinedDate() : LocalDate.now());
        return toDto(familyMemberRepository.save(member));
    }

    /**
     * Closes a membership row rather than deleting it -- household
     * composition must be reconstructable at any past date (e.g. for
     * inheritance/eligibility determinations), which is the whole reason
     * this is modelled as historical rows instead of a current-state flag.
     */
    @Transactional
    public FamilyMemberDto leaveFamilyMember(Long familyRecordId, Long memberId, LeaveFamilyMemberRequest request) {
        FamilyMember member = familyMemberRepository.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Family membership not found: " + memberId));
        if (!member.getFamilyRecord().getId().equals(familyRecordId)) {
            throw new BadRequestException("That membership does not belong to this family record.");
        }
        if (member.getLeftDate() != null) {
            throw new BadRequestException("This membership was already closed on " + member.getLeftDate() + ".");
        }
        member.setLeftDate(request.leftDate() != null ? request.leftDate() : LocalDate.now());
        member.setLeftReason(request.leftReason());
        return toDto(familyMemberRepository.save(member));
    }

    public List<FamilyMemberDto> familyHistoryForCitizen(Long citizenId) {
        return familyMemberRepository.findByCitizenId(citizenId).stream().map(this::toDto).toList();
    }

    // ==== guardianship ====================================================

    @Transactional
    public GuardianshipDto createGuardianship(CreateGuardianshipRequest request, AppUserPrincipal actor) {
        Citizen minor = findCitizen(request.minorCitizenId());
        Citizen guardian = findCitizen(request.guardianCitizenId());
        if (minor.getId().equals(guardian.getId())) {
            throw new BadRequestException("A citizen cannot be their own guardian.");
        }
        GuardianshipRecord record = new GuardianshipRecord();
        record.setMinorCitizen(minor);
        record.setGuardianCitizen(guardian);
        record.setGuardianshipType(parseGuardianshipType(request.guardianshipType()));
        record.setCourtDecisionNumber(request.courtDecisionNumber());
        // Mandatory court link (Court is @NotNull/optional=false on the
        // entity too) -- guardianship requires court authority under
        // Lebanese personal-status law; there's no path here to create one
        // without an identified court, matching FR-04's own verification
        // note ("reject without").
        record.setCourt(findCourt(request.courtId()));
        record.setStartDate(request.startDate());
        record.setEndDate(request.endDate());
        record.setStatus(GuardianshipStatus.ACTIVE);
        record.setCreatedBy(currentUser(actor));
        return toDto(guardianshipRepository.save(record));
    }

    public List<GuardianshipDto> activeGuardiansOf(Long minorCitizenId) {
        return guardianshipRepository.findByMinorCitizenIdAndStatus(minorCitizenId, GuardianshipStatus.ACTIVE)
                .stream().map(this::toDto).toList();
    }

    // ==== registry transfers ==============================================

    @Transactional
    public RegistryTransferDto requestTransfer(RequestTransferRequest request, AppUserPrincipal actor) {
        Citizen citizen = findCitizen(request.citizenId());
        Office fromOffice = citizen.getRegisteredOffice();
        if (fromOffice == null) {
            throw new BadRequestException("This citizen has no registered office to transfer from.");
        }
        Office toOffice = findOffice(request.toOfficeId());
        if (fromOffice.getId().equals(toOffice.getId())) {
            throw new BadRequestException("This citizen is already registered at that office.");
        }
        RegistryTransfer transfer = new RegistryTransfer();
        transfer.setCitizen(citizen);
        transfer.setFromOffice(fromOffice);
        transfer.setToOffice(toOffice);
        transfer.setRequestedBy(currentUser(actor));
        transfer.setRequestedAt(Instant.now());
        transfer.setTransferDate(request.transferDate());
        transfer.setStatus(ApprovalStatus.PENDING);
        return toDto(transferRepository.save(transfer));
    }

    @Transactional
    public RegistryTransferDto decideTransfer(Long id, DecideTransferRequest request, AppUserPrincipal actor) {
        RegistryTransfer transfer = transferRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Registry transfer not found: " + id));
        if (transfer.getStatus() != ApprovalStatus.PENDING) {
            throw new BadRequestException("This transfer was already decided.");
        }
        AppUser decider = currentUser(actor);
        // SI-12: the approver must differ from whoever requested it --
        // segregation of duties is the whole reason this is a two-actor
        // workflow instead of a single field update.
        if (transfer.getRequestedBy().getId().equals(decider.getId())) {
            throw new BadRequestException("The approver must be different from whoever requested the transfer.");
        }
        boolean approve = parseDecision(request.decision());
        transfer.setApprovedBy(decider);
        transfer.setApprovedAt(Instant.now());
        if (request.decisionReference() != null) transfer.setDecisionReference(request.decisionReference());
        if (approve) {
            transfer.setStatus(ApprovalStatus.APPROVED);
            if (transfer.getTransferDate() == null) transfer.setTransferDate(LocalDate.now());
            // The actual effect of an approved transfer: the citizen's
            // registry now belongs to the destination office. Without
            // this, "approving" a transfer would be pure bookkeeping with
            // no real consequence, which defeats the point of modelling
            // it as an event in the first place.
            Citizen citizen = transfer.getCitizen();
            citizen.setRegisteredOffice(transfer.getToOffice());
            citizenRepository.save(citizen);
            // Item 6, tier 2: field-level log for the office reassignment
            // this approval actually causes -- amendmentId left null,
            // since this change is backed by a RegistryTransfer, not a
            // CivilStatusAmendment.
            citizenAuditService.logFieldChange(citizen, null, "registeredOffice",
                    transfer.getFromOffice().getCode(), transfer.getToOffice().getCode(), decider,
                    "Registry transfer #" + transfer.getId());
        } else {
            transfer.setStatus(ApprovalStatus.REJECTED);
        }
        return toDto(transferRepository.save(transfer));
    }

    public List<RegistryTransferDto> transfersForCitizen(Long citizenId) {
        return transferRepository.findByCitizenId(citizenId).stream().map(this::toDto).toList();
    }

    // ==== civil status amendments ==========================================

    // A deliberately small whitelist of fields this system will actually
    // apply to the citizen record on approval. The source design docs
    // flag "which fields are amendable" as an open question with no
    // whitelist given -- rather than leave it as free text that silently
    // does nothing when approved (or, worse, blindly reflect onto any
    // column name a caller supplies), this resolves that question with
    // a small, safe, explicitly-documented set.
    private static final List<String> AMENDABLE_FIELDS = List.of(
            "firstNameEn", "lastNameEn", "firstNameAr", "lastNameAr", "religion", "sect",
            "maritalStatus", "nationality");

    @Transactional
    public CivilStatusAmendmentDto requestAmendment(RequestAmendmentRequest request, AppUserPrincipal actor) {
        Citizen citizen = findCitizen(request.citizenId());
        CivilStatusAmendment amendment = new CivilStatusAmendment();
        amendment.setCitizen(citizen);
        amendment.setFieldChanged(request.fieldChanged());
        amendment.setOldValue(request.oldValue());
        amendment.setNewValue(request.newValue());
        // legalBasis is @NotBlank on the request DTO already (SI-11) --
        // this is the most important integrity rule in this domain per
        // the design docs, so it's enforced at the point of entry, not
        // just checked again before approval.
        amendment.setLegalBasis(request.legalBasis());
        amendment.setCourtDecisionNumber(request.courtDecisionNumber());
        if (request.courtId() != null) amendment.setCourt(findCourt(request.courtId()));
        amendment.setRequestedBy(currentUser(actor));
        amendment.setAmendmentDate(request.amendmentDate());
        amendment.setStatus(ApprovalStatus.PENDING);
        return toDto(amendmentRepository.save(amendment));
    }

    @Transactional
    public CivilStatusAmendmentDto decideAmendment(Long id, DecideAmendmentRequest request, AppUserPrincipal actor) {
        CivilStatusAmendment amendment = amendmentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Amendment not found: " + id));
        if (amendment.getStatus() != ApprovalStatus.PENDING) {
            throw new BadRequestException("This amendment was already decided.");
        }
        AppUser decider = currentUser(actor);
        if (amendment.getRequestedBy().getId().equals(decider.getId())) {
            throw new BadRequestException("The approver must be different from whoever requested the amendment.");
        }
        boolean approve = parseDecision(request.decision());
        amendment.setApprovedBy(decider);
        amendment.setApprovedAt(Instant.now());
        if (approve) {
            // Defensive re-check of SI-11 even though the request DTO
            // already requires a non-blank legal basis -- this is "the
            // most important integrity rule in the schema" per the
            // design docs, so it's worth guarding twice.
            if (amendment.getLegalBasis() == null || amendment.getLegalBasis().isBlank()) {
                throw new BadRequestException("Cannot approve an amendment with no legal basis on file.");
            }
            amendment.setStatus(ApprovalStatus.APPROVED);
            applyAmendmentIfWhitelisted(amendment, decider);
        } else {
            amendment.setStatus(ApprovalStatus.REJECTED);
        }
        return toDto(amendmentRepository.save(amendment));
    }

    private void applyAmendmentIfWhitelisted(CivilStatusAmendment amendment, AppUser decider) {
        if (!AMENDABLE_FIELDS.contains(amendment.getFieldChanged())) {
            return; // recorded, but not auto-applied -- see AMENDABLE_FIELDS
        }
        Citizen citizen = amendment.getCitizen();
        String value = amendment.getNewValue();
        // Item 6, tier 2: the *actual* prior value read off the citizen
        // right before it's overwritten, not amendment.getOldValue() --
        // the amendment's own oldValue is whatever the requester typed
        // when filing it, which could be stale by the time it's decided;
        // the audit trail should reflect what genuinely changed.
        String actualOldValue = switch (amendment.getFieldChanged()) {
            case "firstNameEn" -> citizen.getFirstNameEn();
            case "lastNameEn" -> citizen.getLastNameEn();
            case "firstNameAr" -> citizen.getFirstNameAr();
            case "lastNameAr" -> citizen.getLastNameAr();
            case "religion" -> citizen.getReligion();
            case "sect" -> citizen.getSect();
            case "nationality" -> citizen.getNationality();
            case "maritalStatus" -> citizen.getMaritalStatus() == null ? null : citizen.getMaritalStatus().name();
            default -> null;
        };
        switch (amendment.getFieldChanged()) {
            case "firstNameEn" -> citizen.setFirstNameEn(value);
            case "lastNameEn" -> citizen.setLastNameEn(value);
            case "firstNameAr" -> citizen.setFirstNameAr(value);
            case "lastNameAr" -> citizen.setLastNameAr(value);
            case "religion" -> citizen.setReligion(value);
            case "sect" -> citizen.setSect(value);
            case "nationality" -> citizen.setNationality(value);
            case "maritalStatus" -> {
                try {
                    citizen.setMaritalStatus(value == null ? null : MaritalStatus.valueOf(value.toUpperCase(Locale.ROOT)));
                } catch (IllegalArgumentException e) {
                    throw new BadRequestException("Unknown marital status: " + value);
                }
            }
            default -> { /* unreachable given AMENDABLE_FIELDS.contains(...) above */ }
        }
        citizenRepository.save(citizen);
        citizenAuditService.logFieldChange(citizen, amendment, amendment.getFieldChanged(), actualOldValue, value,
                decider, amendment.getLegalBasis());
    }

    public List<CivilStatusAmendmentDto> amendmentsForCitizen(Long citizenId) {
        return amendmentRepository.findByCitizenIdOrderByAmendmentDateDesc(citizenId).stream().map(this::toDto).toList();
    }

    // ==== helpers ==========================================================

    private boolean parseDecision(String raw) {
        String v = raw == null ? "" : raw.toUpperCase(Locale.ROOT);
        if (v.equals("APPROVE")) return true;
        if (v.equals("REJECT")) return false;
        throw new BadRequestException("decision must be APPROVE or REJECT, got: " + raw);
    }

    private FamilyRelationship parseRelationship(String raw) {
        try {
            return FamilyRelationship.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown family relationship: " + raw);
        }
    }

    private GuardianshipType parseGuardianshipType(String raw) {
        try {
            return GuardianshipType.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown guardianship type: " + raw);
        }
    }

    private Citizen findCitizen(Long id) {
        return citizenRepository.findById(id).orElseThrow(() -> new NotFoundException("Citizen not found: " + id));
    }

    private Office findOffice(Long id) {
        return officeRepository.findById(id).orElseThrow(() -> new NotFoundException("Office not found: " + id));
    }

    private Court findCourt(Long id) {
        return courtRepository.findById(id).orElseThrow(() -> new NotFoundException("Court not found: " + id));
    }

    private FamilyRecord findFamilyRecord(Long id) {
        return familyRecordRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Family record not found: " + id));
    }

    private AppUser currentUser(AppUserPrincipal actor) {
        if (actor == null) throw new BadRequestException("Authenticated user required.");
        return userRepository.findById(actor.getId())
                .orElseThrow(() -> new NotFoundException("Authenticated user vanished: " + actor.getId()));
    }

    private FamilyRecordDto toDto(FamilyRecord r) {
        List<FamilyMemberDto> members = familyMemberRepository.findByFamilyRecordId(r.getId()).stream()
                .map(this::toDto).toList();
        return new FamilyRecordDto(r.getId(), r.getFamilyBookNumber(), r.getHeadOfHousehold().getId(),
                r.getHeadOfHousehold().getFirstNameEn() + " " + r.getHeadOfHousehold().getLastNameEn(),
                r.getRegistrationOffice() != null ? r.getRegistrationOffice().getId() : null, r.isActive(), members);
    }

    private FamilyMemberDto toDto(FamilyMember m) {
        return new FamilyMemberDto(m.getId(), m.getFamilyRecord().getId(), m.getCitizen().getId(),
                m.getCitizen().getFirstNameEn() + " " + m.getCitizen().getLastNameEn(),
                m.getRelationship().name(), m.getJoinedDate(), m.getLeftDate(), m.getLeftReason());
    }

    private GuardianshipDto toDto(GuardianshipRecord g) {
        return new GuardianshipDto(g.getId(), g.getMinorCitizen().getId(),
                g.getMinorCitizen().getFirstNameEn() + " " + g.getMinorCitizen().getLastNameEn(),
                g.getGuardianCitizen().getId(),
                g.getGuardianCitizen().getFirstNameEn() + " " + g.getGuardianCitizen().getLastNameEn(),
                g.getGuardianshipType().name(), g.getCourtDecisionNumber(), g.getCourt().getId(),
                g.getCourt().getNameEn(), g.getStartDate(), g.getEndDate(), g.getStatus().name());
    }

    private RegistryTransferDto toDto(RegistryTransfer t) {
        return new RegistryTransferDto(t.getId(), t.getCitizen().getId(),
                t.getCitizen().getFirstNameEn() + " " + t.getCitizen().getLastNameEn(), t.getFromOffice().getId(),
                t.getFromOffice().getNameEn(), t.getToOffice().getId(), t.getToOffice().getNameEn(),
                t.getRequestedBy().getFullName(), t.getRequestedAt(),
                t.getApprovedBy() != null ? t.getApprovedBy().getFullName() : null, t.getApprovedAt(),
                t.getDecisionReference(), t.getStatus().name(), t.getTransferDate());
    }

    private CivilStatusAmendmentDto toDto(CivilStatusAmendment a) {
        return new CivilStatusAmendmentDto(a.getId(), a.getCitizen().getId(),
                a.getCitizen().getFirstNameEn() + " " + a.getCitizen().getLastNameEn(), a.getFieldChanged(),
                a.getOldValue(), a.getNewValue(), a.getLegalBasis(), a.getCourtDecisionNumber(),
                a.getCourt() != null ? a.getCourt().getId() : null, a.getRequestedBy().getFullName(),
                a.getApprovedBy() != null ? a.getApprovedBy().getFullName() : null, a.getApprovedAt(),
                a.getAmendmentDate(), a.getStatus().name());
    }
}
