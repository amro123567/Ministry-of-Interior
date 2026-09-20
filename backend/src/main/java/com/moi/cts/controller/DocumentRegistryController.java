package com.moi.cts.controller;

import com.moi.cts.audit.Audited;
import com.moi.cts.dto.DocumentRegistryDtos.*;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.DocumentRegistryService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The generic document supertype plus its 7 specialised subtypes (ERD
 * domain 6): birth/marriage/divorce/death certificates, national ID
 * cards, naturalization and name-change records. Issuing any subtype
 * requires {@code CITIZEN_MANAGE} (see SecurityConfig) -- the same
 * civil-registry-write permission as citizen creation, family records,
 * guardianship, and registry-transfer/amendment requests; reads stay
 * open to any authenticated user.
 */
@RestController
public class DocumentRegistryController {

    private final DocumentRegistryService documentRegistryService;

    public DocumentRegistryController(DocumentRegistryService documentRegistryService) {
        this.documentRegistryService = documentRegistryService;
    }

    @GetMapping("/api/citizens/{citizenId}/documents")
    public List<DocumentDto> documentsForCitizen(@PathVariable Long citizenId) {
        return documentRegistryService.documentsForCitizen(citizenId);
    }

    @GetMapping("/api/documents/{id}")
    public DocumentDto getDocument(@PathVariable Long id) {
        return documentRegistryService.getDocument(id);
    }

    @PostMapping("/api/documents/birth-certificates")
    @Audited(entityType = "BirthCertificate", action = "CREATE")
    public BirthCertificateDto createBirthCertificate(@Valid @RequestBody CreateBirthCertificateRequest request,
                                                        @AuthenticationPrincipal AppUserPrincipal actor) {
        return documentRegistryService.createBirthCertificate(request, actor);
    }

    @GetMapping("/api/documents/birth-certificates/{documentId}")
    public BirthCertificateDto getBirthCertificate(@PathVariable Long documentId) {
        return documentRegistryService.getBirthCertificate(documentId);
    }

    @PostMapping("/api/documents/marriage-certificates")
    @Audited(entityType = "MarriageCertificate", action = "CREATE")
    public MarriageCertificateDto createMarriageCertificate(@Valid @RequestBody CreateMarriageCertificateRequest request,
                                                              @AuthenticationPrincipal AppUserPrincipal actor) {
        return documentRegistryService.createMarriageCertificate(request, actor);
    }

    @GetMapping("/api/documents/marriage-certificates/{documentId}")
    public MarriageCertificateDto getMarriageCertificate(@PathVariable Long documentId) {
        return documentRegistryService.getMarriageCertificate(documentId);
    }

    @PostMapping("/api/documents/divorce-certificates")
    @Audited(entityType = "DivorceCertificate", action = "CREATE")
    public DivorceCertificateDto createDivorceCertificate(@Valid @RequestBody CreateDivorceCertificateRequest request,
                                                            @AuthenticationPrincipal AppUserPrincipal actor) {
        return documentRegistryService.createDivorceCertificate(request, actor);
    }

    @GetMapping("/api/documents/divorce-certificates/{documentId}")
    public DivorceCertificateDto getDivorceCertificate(@PathVariable Long documentId) {
        return documentRegistryService.getDivorceCertificate(documentId);
    }

    @PostMapping("/api/documents/death-certificates")
    @Audited(entityType = "DeathCertificate", action = "CREATE")
    public DeathCertificateDto createDeathCertificate(@Valid @RequestBody CreateDeathCertificateRequest request,
                                                        @AuthenticationPrincipal AppUserPrincipal actor) {
        return documentRegistryService.createDeathCertificate(request, actor);
    }

    @GetMapping("/api/documents/death-certificates/{documentId}")
    public DeathCertificateDto getDeathCertificate(@PathVariable Long documentId) {
        return documentRegistryService.getDeathCertificate(documentId);
    }

    @PostMapping("/api/documents/national-id-cards")
    @Audited(entityType = "NationalIdCard", action = "CREATE")
    public NationalIdCardDto createNationalIdCard(@Valid @RequestBody CreateNationalIdCardRequest request,
                                                    @AuthenticationPrincipal AppUserPrincipal actor) {
        return documentRegistryService.createNationalIdCard(request, actor);
    }

    @GetMapping("/api/citizens/{citizenId}/national-id-cards")
    public List<NationalIdCardDto> cardsForCitizen(@PathVariable Long citizenId) {
        return documentRegistryService.cardsForCitizen(citizenId);
    }

    @PostMapping("/api/documents/naturalization-records")
    @Audited(entityType = "NaturalizationRecord", action = "CREATE")
    public NaturalizationRecordDto createNaturalizationRecord(@Valid @RequestBody CreateNaturalizationRecordRequest request,
                                                                @AuthenticationPrincipal AppUserPrincipal actor) {
        return documentRegistryService.createNaturalizationRecord(request, actor);
    }

    @GetMapping("/api/documents/naturalization-records/{documentId}")
    public NaturalizationRecordDto getNaturalizationRecord(@PathVariable Long documentId) {
        return documentRegistryService.getNaturalizationRecord(documentId);
    }

    @PostMapping("/api/documents/name-change-records")
    @Audited(entityType = "NameChangeRecord", action = "CREATE")
    public NameChangeRecordDto createNameChangeRecord(@Valid @RequestBody CreateNameChangeRecordRequest request,
                                                        @AuthenticationPrincipal AppUserPrincipal actor) {
        return documentRegistryService.createNameChangeRecord(request, actor);
    }

    @GetMapping("/api/documents/name-change-records/{documentId}")
    public NameChangeRecordDto getNameChangeRecord(@PathVariable Long documentId) {
        return documentRegistryService.getNameChangeRecord(documentId);
    }
}
