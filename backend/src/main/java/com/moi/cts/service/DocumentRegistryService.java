package com.moi.cts.service;

import com.moi.cts.dto.DocumentRegistryDtos.*;
import com.moi.cts.entity.*;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.*;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

/**
 * The generic {@link Document} supertype plus its 7 specialised subtypes
 * (ERD domain 6). Each {@code createX(...)} method creates the parent
 * {@code Document} row and its one subtype row together, in a single
 * transaction -- the two inserts the SDD's own Class Table Inheritance
 * analysis calls out as this pattern's one real cost, always issued as a
 * pair so a {@code documents} row can never exist without its subtype (or
 * vice versa).
 */
@Service
public class DocumentRegistryService {

    private final DocumentRepository documentRepository;
    private final BirthCertificateRepository birthCertificateRepository;
    private final MarriageCertificateRepository marriageCertificateRepository;
    private final DivorceCertificateRepository divorceCertificateRepository;
    private final DeathCertificateRepository deathCertificateRepository;
    private final NationalIdCardRepository nationalIdCardRepository;
    private final NaturalizationRecordRepository naturalizationRecordRepository;
    private final NameChangeRecordRepository nameChangeRecordRepository;
    private final CitizenRepository citizenRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final OfficeRepository officeRepository;
    private final MukhtarRepository mukhtarRepository;
    private final CourtRepository courtRepository;
    private final ReligiousAuthorityRepository religiousAuthorityRepository;
    private final CivilStatusAmendmentRepository amendmentRepository;
    private final AppUserRepository userRepository;

    public DocumentRegistryService(DocumentRepository documentRepository,
                                    BirthCertificateRepository birthCertificateRepository,
                                    MarriageCertificateRepository marriageCertificateRepository,
                                    DivorceCertificateRepository divorceCertificateRepository,
                                    DeathCertificateRepository deathCertificateRepository,
                                    NationalIdCardRepository nationalIdCardRepository,
                                    NaturalizationRecordRepository naturalizationRecordRepository,
                                    NameChangeRecordRepository nameChangeRecordRepository,
                                    CitizenRepository citizenRepository, DocumentTypeRepository documentTypeRepository,
                                    OfficeRepository officeRepository, MukhtarRepository mukhtarRepository,
                                    CourtRepository courtRepository,
                                    ReligiousAuthorityRepository religiousAuthorityRepository,
                                    CivilStatusAmendmentRepository amendmentRepository,
                                    AppUserRepository userRepository) {
        this.documentRepository = documentRepository;
        this.birthCertificateRepository = birthCertificateRepository;
        this.marriageCertificateRepository = marriageCertificateRepository;
        this.divorceCertificateRepository = divorceCertificateRepository;
        this.deathCertificateRepository = deathCertificateRepository;
        this.nationalIdCardRepository = nationalIdCardRepository;
        this.naturalizationRecordRepository = naturalizationRecordRepository;
        this.nameChangeRecordRepository = nameChangeRecordRepository;
        this.citizenRepository = citizenRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.officeRepository = officeRepository;
        this.mukhtarRepository = mukhtarRepository;
        this.courtRepository = courtRepository;
        this.religiousAuthorityRepository = religiousAuthorityRepository;
        this.amendmentRepository = amendmentRepository;
        this.userRepository = userRepository;
    }

    // ==== generic supertype ================================================

    public List<DocumentDto> documentsForCitizen(Long citizenId) {
        return documentRepository.findByCitizenId(citizenId).stream().map(this::toDto).toList();
    }

    public DocumentDto getDocument(Long id) {
        return toDto(findDocument(id));
    }

    // ==== birth certificates ===============================================

    @Transactional
    public BirthCertificateDto createBirthCertificate(CreateBirthCertificateRequest request, AppUserPrincipal actor) {
        Document doc = newDocument(request.citizenId(), request.documentTypeId(), request.documentNumber(),
                request.issueDate(), request.issuingOfficeId(), actor);
        if (request.attestedByMukhtarId() != null) {
            doc.setAttestedByMukhtar(findMukhtar(request.attestedByMukhtarId()));
        }
        doc.setStatus(DocumentStatus.ISSUED);
        doc = documentRepository.save(doc);

        BirthCertificate cert = new BirthCertificate();
        cert.setDocument(doc);
        cert.setBirthPlace(request.birthPlace());
        cert.setBirthHospital(request.birthHospital());
        cert.setBirthAttendant(request.birthAttendant());
        cert.setFatherFullNameSnapshot(request.fatherFullNameSnapshot());
        cert.setMotherFullNameSnapshot(request.motherFullNameSnapshot());
        cert.setRegistrationNumber(request.registrationNumber());
        cert.setRegistrarName(request.registrarName());
        return toDto(birthCertificateRepository.save(cert));
    }

    public BirthCertificateDto getBirthCertificate(Long documentId) {
        return toDto(birthCertificateRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Birth certificate not found: " + documentId)));
    }

    // ==== marriage certificates =============================================

    @Transactional
    public MarriageCertificateDto createMarriageCertificate(CreateMarriageCertificateRequest request,
                                                              AppUserPrincipal actor) {
        Citizen husband = findCitizen(request.husbandId());
        Citizen wife = findCitizen(request.wifeId());
        if (husband.getId().equals(wife.getId())) {
            throw new BadRequestException("A citizen cannot be married to themselves.");
        }
        // Uses the husband as the document's subject citizen -- the ERD's
        // documents.civil_registry_number is a single FK, and a marriage
        // certificate concerns two citizens, so one has to be primary for
        // the generic supertype row; the wife is still fully captured on
        // the subtype row itself.
        Document doc = newDocument(request.husbandId(), request.documentTypeId(), request.documentNumber(),
                request.issueDate(), request.issuingOfficeId(), actor);
        doc.setStatus(DocumentStatus.ISSUED);
        doc = documentRepository.save(doc);

        MarriageCertificate cert = new MarriageCertificate();
        cert.setDocument(doc);
        cert.setHusband(husband);
        cert.setWife(wife);
        cert.setHusbandNameSnapshot(husband.getFirstNameEn() + " " + husband.getLastNameEn());
        cert.setWifeNameSnapshot(wife.getFirstNameEn() + " " + wife.getLastNameEn());
        cert.setMarriageDate(request.marriageDate());
        cert.setMarriagePlace(request.marriagePlace());
        if (request.courtId() != null) cert.setCourt(findCourt(request.courtId()));
        if (request.religiousAuthorityId() != null) {
            cert.setReligiousAuthority(findReligiousAuthority(request.religiousAuthorityId()));
        }
        cert.setContractNumber(request.contractNumber());
        cert.setDowryAmount(request.dowryAmount());
        cert.setDowryCurrency(request.dowryCurrency());
        cert.setStatus(UnionStatus.ACTIVE);
        cert = marriageCertificateRepository.save(cert);

        husband.setMaritalStatus(MaritalStatus.MARRIED);
        wife.setMaritalStatus(MaritalStatus.MARRIED);
        citizenRepository.save(husband);
        citizenRepository.save(wife);
        return toDto(cert);
    }

    public MarriageCertificateDto getMarriageCertificate(Long documentId) {
        return toDto(findMarriageCertificate(documentId));
    }

    // ==== divorce certificates ===============================================

    @Transactional
    public DivorceCertificateDto createDivorceCertificate(CreateDivorceCertificateRequest request,
                                                            AppUserPrincipal actor) {
        MarriageCertificate marriage = findMarriageCertificate(request.marriageCertificateId());
        // ERD UNIQUE(marriage_certificate_id): at most one divorce per
        // marriage, enforced here (not just left to the DB constraint) so
        // the rejection carries a clear message instead of a raw
        // constraint-violation stack trace.
        if (divorceCertificateRepository.existsByMarriageCertificateDocumentId(marriage.getDocumentId())) {
            throw new BadRequestException("A divorce certificate already exists for this marriage.");
        }
        Document doc = newDocument(marriage.getHusband().getId(), request.documentTypeId(), request.documentNumber(),
                request.issueDate(), request.issuingOfficeId(), actor);
        doc.setStatus(DocumentStatus.ISSUED);
        doc = documentRepository.save(doc);

        DivorceCertificate cert = new DivorceCertificate();
        cert.setDocument(doc);
        cert.setMarriageCertificate(marriage);
        cert.setHusband(marriage.getHusband());
        cert.setWife(marriage.getWife());
        cert.setDivorceDate(request.divorceDate());
        cert.setDivorcePlace(request.divorcePlace());
        if (request.courtId() != null) cert.setCourt(findCourt(request.courtId()));
        cert.setCourtDecisionNumber(request.courtDecisionNumber());
        cert.setDivorceType(parseDivorceType(request.divorceType()));
        cert.setDivorceReason(request.divorceReason());
        cert.setChildCustodyAgreement(request.childCustodyAgreement());
        cert.setFinancialSettlement(request.financialSettlement());
        cert.setSettlementAmount(request.settlementAmount());
        cert.setSettlementCurrency(request.settlementCurrency());
        if (request.religiousAuthorityId() != null) {
            cert.setReligiousAuthority(findReligiousAuthority(request.religiousAuthorityId()));
        }
        cert.setShariaCourtApproval(request.shariaCourtApproval());
        cert.setStatus(RecordStatus.ACTIVE);
        cert = divorceCertificateRepository.save(cert);

        // Real effect, not just bookkeeping: the marriage this dissolves
        // is flipped to DISSOLVED, and both parties revert to DIVORCED --
        // the same "approval has a consequence" pattern Item 2's registry
        // transfers/amendments follow.
        marriage.setStatus(UnionStatus.DISSOLVED);
        marriageCertificateRepository.save(marriage);
        Citizen husband = marriage.getHusband();
        Citizen wife = marriage.getWife();
        husband.setMaritalStatus(MaritalStatus.DIVORCED);
        wife.setMaritalStatus(MaritalStatus.DIVORCED);
        citizenRepository.save(husband);
        citizenRepository.save(wife);
        return toDto(cert);
    }

    public DivorceCertificateDto getDivorceCertificate(Long documentId) {
        return toDto(divorceCertificateRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Divorce certificate not found: " + documentId)));
    }

    // ==== death certificates =================================================

    @Transactional
    public DeathCertificateDto createDeathCertificate(CreateDeathCertificateRequest request, AppUserPrincipal actor) {
        Citizen citizen = findCitizen(request.citizenId());
        Document doc = newDocument(request.citizenId(), request.documentTypeId(), request.documentNumber(),
                request.issueDate(), request.issuingOfficeId(), actor);
        doc.setStatus(DocumentStatus.ISSUED);
        doc = documentRepository.save(doc);

        DeathCertificate cert = new DeathCertificate();
        cert.setDocument(doc);
        cert.setDeathDate(request.deathDate());
        cert.setDeathPlace(request.deathPlace());
        cert.setDeathCause(request.deathCause());
        cert.setCertifyingPhysician(request.certifyingPhysician());
        cert.setBurialPlace(request.burialPlace());
        cert.setBurialDate(request.burialDate());
        cert = deathCertificateRepository.save(cert);

        // R-09 from the design docs: issuing a death certificate should
        // set citizens.is_deceased in the same transaction, not leave it
        // as a separate manual step someone might forget.
        citizen.setDeceased(true);
        citizenRepository.save(citizen);
        return toDto(cert);
    }

    public DeathCertificateDto getDeathCertificate(Long documentId) {
        return toDto(deathCertificateRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Death certificate not found: " + documentId)));
    }

    // ==== national ID cards ===================================================

    @Transactional
    public NationalIdCardDto createNationalIdCard(CreateNationalIdCardRequest request, AppUserPrincipal actor) {
        Document doc = newDocument(request.citizenId(), request.documentTypeId(), request.documentNumber(),
                request.issueDate(), request.issuingOfficeId(), actor);
        doc.setExpiryDate(request.expiryDate());
        doc.setStatus(DocumentStatus.ISSUED);
        doc = documentRepository.save(doc);

        NationalIdCard card = new NationalIdCard();
        card.setDocument(doc);
        card.setCardNumber(request.cardNumber());
        card.setBiometricPhotoPath(request.biometricPhotoPath());
        card.setBiometricPhotoHash(request.biometricPhotoHash());
        card.setFingerprintHash(request.fingerprintHash());
        card.setChipSerialNumber(request.chipSerialNumber());
        card.setStatus(CardStatus.ACTIVE);
        return toDto(nationalIdCardRepository.save(card));
    }

    public List<NationalIdCardDto> cardsForCitizen(Long citizenId) {
        return nationalIdCardRepository.findByDocument_CitizenId(citizenId).stream().map(this::toDto).toList();
    }

    // ==== naturalization records ===============================================

    @Transactional
    public NaturalizationRecordDto createNaturalizationRecord(CreateNaturalizationRecordRequest request,
                                                                AppUserPrincipal actor) {
        Citizen citizen = findCitizen(request.citizenId());
        Document doc = newDocument(request.citizenId(), request.documentTypeId(), request.documentNumber(),
                request.issueDate(), request.issuingOfficeId(), actor);
        doc.setStatus(DocumentStatus.ISSUED);
        doc = documentRepository.save(doc);

        NaturalizationRecord record = new NaturalizationRecord();
        record.setDocument(doc);
        record.setPreviousNationality(request.previousNationality());
        record.setNaturalizationDate(request.naturalizationDate());
        record.setDecreeNumber(request.decreeNumber());
        record.setDecreeDate(request.decreeDate());
        record.setStatus(RecordStatus.ACTIVE);
        record = naturalizationRecordRepository.save(record);

        // Real effect: citizens.nationality is the *current* value; a
        // naturalization decree changes it, same "approval has a
        // consequence" pattern used throughout this migration.
        citizen.setNationality("Lebanese");
        citizenRepository.save(citizen);
        return toDto(record);
    }

    public NaturalizationRecordDto getNaturalizationRecord(Long documentId) {
        return toDto(naturalizationRecordRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Naturalization record not found: " + documentId)));
    }

    // ==== name change records ===================================================

    @Transactional
    public NameChangeRecordDto createNameChangeRecord(CreateNameChangeRecordRequest request, AppUserPrincipal actor) {
        Citizen citizen = findCitizen(request.citizenId());
        Document doc = newDocument(request.citizenId(), request.documentTypeId(), request.documentNumber(),
                request.issueDate(), request.issuingOfficeId(), actor);
        doc.setStatus(DocumentStatus.ISSUED);
        doc = documentRepository.save(doc);

        NameChangeRecord record = new NameChangeRecord();
        record.setDocument(doc);
        if (request.amendmentId() != null) {
            record.setAmendment(amendmentRepository.findById(request.amendmentId())
                    .orElseThrow(() -> new NotFoundException("Amendment not found: " + request.amendmentId())));
        }
        record.setOldFirstName(request.oldFirstName());
        record.setOldMiddleName(request.oldMiddleName());
        record.setOldLastName(request.oldLastName());
        record.setNewFirstName(request.newFirstName());
        record.setNewMiddleName(request.newMiddleName());
        record.setNewLastName(request.newLastName());
        record.setReason(request.reason());
        record.setCourtDecisionNumber(request.courtDecisionNumber());
        record.setChangeDate(request.changeDate());
        record = nameChangeRecordRepository.save(record);

        // Real effect: the certificate's new name is what the citizen
        // record shows going forward.
        citizen.setFirstNameEn(request.newFirstName());
        if (request.newMiddleName() != null) citizen.setMiddleNameEn(request.newMiddleName());
        if (request.newLastName() != null) citizen.setLastNameEn(request.newLastName());
        citizenRepository.save(citizen);
        return toDto(record);
    }

    public NameChangeRecordDto getNameChangeRecord(Long documentId) {
        return toDto(nameChangeRecordRepository.findById(documentId)
                .orElseThrow(() -> new NotFoundException("Name change record not found: " + documentId)));
    }

    // ==== shared helpers ========================================================

    private Document newDocument(Long citizenId, Long documentTypeId, String documentNumber,
                                  java.time.LocalDate issueDate, Long issuingOfficeId, AppUserPrincipal actor) {
        Document doc = new Document();
        doc.setCitizen(findCitizen(citizenId));
        doc.setDocumentType(findDocumentType(documentTypeId));
        doc.setDocumentNumber(documentNumber);
        doc.setIssueDate(issueDate);
        if (issuingOfficeId != null) {
            doc.setIssuingOffice(findOffice(issuingOfficeId));
        }
        if (actor != null) {
            AppUser user = userRepository.findById(actor.getId()).orElse(null);
            doc.setCreatedBy(user);
        }
        return doc;
    }

    private Citizen findCitizen(Long id) {
        return citizenRepository.findById(id).orElseThrow(() -> new NotFoundException("Citizen not found: " + id));
    }

    private com.moi.cts.entity.DocumentType findDocumentType(Long id) {
        return documentTypeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Document type not found: " + id));
    }

    private Office findOffice(Long id) {
        return officeRepository.findById(id).orElseThrow(() -> new NotFoundException("Office not found: " + id));
    }

    private Mukhtar findMukhtar(Long id) {
        return mukhtarRepository.findById(id).orElseThrow(() -> new NotFoundException("Mukhtar not found: " + id));
    }

    private Court findCourt(Long id) {
        return courtRepository.findById(id).orElseThrow(() -> new NotFoundException("Court not found: " + id));
    }

    private ReligiousAuthority findReligiousAuthority(Long id) {
        return religiousAuthorityRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Religious authority not found: " + id));
    }

    private MarriageCertificate findMarriageCertificate(Long id) {
        return marriageCertificateRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Marriage certificate not found: " + id));
    }

    private Document findDocument(Long id) {
        return documentRepository.findById(id).orElseThrow(() -> new NotFoundException("Document not found: " + id));
    }

    private DivorceType parseDivorceType(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return DivorceType.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown divorce type: " + raw);
        }
    }

    private DocumentDto toDto(Document d) {
        return new DocumentDto(d.getId(), d.getDocumentType().getId(), d.getDocumentType().getCode(),
                d.getDocumentType().getNameEn(), d.getCitizen().getId(),
                d.getCitizen().getFirstNameEn() + " " + d.getCitizen().getLastNameEn(), d.getDocumentNumber(),
                d.getIssueDate(), d.getExpiryDate(), d.getIssuingOffice() != null ? d.getIssuingOffice().getId() : null,
                d.getIssuingOffice() != null ? d.getIssuingOffice().getNameEn() : null,
                d.getAttestedByMukhtar() != null ? d.getAttestedByMukhtar().getId() : null, d.getFileHash(),
                d.getFileSize(), d.getMimeType(), d.getStatus().name(), d.getVersion(), d.isLatest(), d.isDeleted(),
                d.getCreatedAt());
    }

    private BirthCertificateDto toDto(BirthCertificate c) {
        return new BirthCertificateDto(toDto(c.getDocument()), c.getBirthPlace(), c.getBirthHospital(),
                c.getBirthAttendant(), c.getFatherFullNameSnapshot(), c.getMotherFullNameSnapshot(),
                c.getRegistrationNumber(), c.getRegistrarName());
    }

    private MarriageCertificateDto toDto(MarriageCertificate c) {
        return new MarriageCertificateDto(toDto(c.getDocument()), c.getHusband().getId(), c.getHusbandNameSnapshot(),
                c.getWife().getId(), c.getWifeNameSnapshot(), c.getMarriageDate(), c.getMarriagePlace(),
                c.getCourt() != null ? c.getCourt().getId() : null,
                c.getReligiousAuthority() != null ? c.getReligiousAuthority().getId() : null, c.getContractNumber(),
                c.getDowryAmount(), c.getDowryCurrency(), c.getStatus().name());
    }

    private DivorceCertificateDto toDto(DivorceCertificate c) {
        return new DivorceCertificateDto(toDto(c.getDocument()), c.getMarriageCertificate().getDocumentId(),
                c.getHusband().getId(), c.getHusband().getFirstNameEn() + " " + c.getHusband().getLastNameEn(),
                c.getWife().getId(), c.getWife().getFirstNameEn() + " " + c.getWife().getLastNameEn(),
                c.getDivorceDate(), c.getDivorceType() != null ? c.getDivorceType().name() : null,
                c.getStatus().name());
    }

    private DeathCertificateDto toDto(DeathCertificate c) {
        return new DeathCertificateDto(toDto(c.getDocument()), c.getDeathDate(), c.getDeathPlace(),
                c.getDeathCause(), c.getCertifyingPhysician(), c.getBurialPlace(), c.getBurialDate());
    }

    private NationalIdCardDto toDto(NationalIdCard c) {
        return new NationalIdCardDto(toDto(c.getDocument()), c.getCardNumber(), c.getBiometricPhotoPath(),
                c.getFingerprintHash(), c.getChipSerialNumber(), c.getStatus().name());
    }

    private NaturalizationRecordDto toDto(NaturalizationRecord r) {
        return new NaturalizationRecordDto(toDto(r.getDocument()), r.getPreviousNationality(),
                r.getNaturalizationDate(), r.getDecreeNumber(), r.getDecreeDate(), r.getStatus().name());
    }

    private NameChangeRecordDto toDto(NameChangeRecord r) {
        return new NameChangeRecordDto(toDto(r.getDocument()), r.getAmendment() != null ? r.getAmendment().getId() : null,
                r.getOldFirstName(), r.getNewFirstName(), r.getReason(), r.getChangeDate());
    }
}
