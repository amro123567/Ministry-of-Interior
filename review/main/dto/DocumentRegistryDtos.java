package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * DTOs for the document supertype/subtype domain (ERD domain 6, minus
 * {@code document_validations} and {@code physical_document_handling},
 * which are out of this item's scope -- see {@code Document}'s Javadoc).
 */
public class DocumentRegistryDtos {

    // ---- generic supertype -------------------------------------------
    public record DocumentDto(Long id, Long documentTypeId, String documentTypeCode, String documentTypeName,
                               Long citizenId, String citizenName, String documentNumber, LocalDate issueDate,
                               LocalDate expiryDate, Long issuingOfficeId, String issuingOfficeName,
                               Long attestedByMukhtarId, String fileHash, Integer fileSize, String mimeType,
                               String status, int version, boolean isLatest, boolean isDeleted, Instant createdAt) {}

    // A shared base for the "common to every subtype" fields a create
    // request needs -- not a record itself (records can't be extended),
    // just documentation of the fields every CreateXRequest below repeats:
    // citizenId/husbandId+wifeId (whichever applies), documentTypeId,
    // documentNumber, issueDate, issuingOfficeId.

    // ---- birth certificates ---------------------------------------------
    public record CreateBirthCertificateRequest(@NotNull Long citizenId, @NotNull Long documentTypeId,
                                                 String documentNumber, LocalDate issueDate, Long issuingOfficeId,
                                                 Long attestedByMukhtarId, String birthPlace, String birthHospital,
                                                 String birthAttendant, String fatherFullNameSnapshot,
                                                 String motherFullNameSnapshot, String registrationNumber,
                                                 String registrarName) {}

    public record BirthCertificateDto(DocumentDto document, String birthPlace, String birthHospital,
                                       String birthAttendant, String fatherFullNameSnapshot,
                                       String motherFullNameSnapshot, String registrationNumber,
                                       String registrarName) {}

    // ---- marriage certificates -------------------------------------------
    public record CreateMarriageCertificateRequest(@NotNull Long husbandId, @NotNull Long wifeId,
                                                    @NotNull Long documentTypeId, String documentNumber,
                                                    LocalDate issueDate, Long issuingOfficeId,
                                                    LocalDate marriageDate, String marriagePlace, Long courtId,
                                                    Long religiousAuthorityId, String contractNumber,
                                                    BigDecimal dowryAmount, String dowryCurrency) {}

    public record MarriageCertificateDto(DocumentDto document, Long husbandId, String husbandName, Long wifeId,
                                          String wifeName, LocalDate marriageDate, String marriagePlace,
                                          Long courtId, Long religiousAuthorityId, String contractNumber,
                                          BigDecimal dowryAmount, String dowryCurrency, String status) {}

    // ---- divorce certificates --------------------------------------------
    public record CreateDivorceCertificateRequest(@NotNull Long marriageCertificateId, @NotNull Long documentTypeId,
                                                   String documentNumber, LocalDate issueDate, Long issuingOfficeId,
                                                   LocalDate divorceDate, String divorcePlace, Long courtId,
                                                   String courtDecisionNumber, String divorceType,
                                                   String divorceReason, String childCustodyAgreement,
                                                   String financialSettlement, BigDecimal settlementAmount,
                                                   String settlementCurrency, Long religiousAuthorityId,
                                                   String shariaCourtApproval) {}

    public record DivorceCertificateDto(DocumentDto document, Long marriageCertificateId, Long husbandId,
                                         String husbandName, Long wifeId, String wifeName, LocalDate divorceDate,
                                         String divorceType, String status) {}

    // ---- death certificates -----------------------------------------------
    public record CreateDeathCertificateRequest(@NotNull Long citizenId, @NotNull Long documentTypeId,
                                                 String documentNumber, LocalDate issueDate, Long issuingOfficeId,
                                                 @NotNull LocalDate deathDate, String deathPlace, String deathCause,
                                                 String certifyingPhysician, String burialPlace,
                                                 LocalDate burialDate) {}

    public record DeathCertificateDto(DocumentDto document, LocalDate deathDate, String deathPlace,
                                       String deathCause, String certifyingPhysician, String burialPlace,
                                       LocalDate burialDate) {}

    // ---- national ID cards ------------------------------------------------
    public record CreateNationalIdCardRequest(@NotNull Long citizenId, @NotNull Long documentTypeId,
                                               String documentNumber, LocalDate issueDate, LocalDate expiryDate,
                                               Long issuingOfficeId, @NotBlank String cardNumber,
                                               String biometricPhotoPath, String biometricPhotoHash,
                                               String fingerprintHash, String chipSerialNumber) {}

    public record NationalIdCardDto(DocumentDto document, String cardNumber, String biometricPhotoPath,
                                     String fingerprintHash, String chipSerialNumber, String status) {}

    // ---- naturalization records --------------------------------------------
    public record CreateNaturalizationRecordRequest(@NotNull Long citizenId, @NotNull Long documentTypeId,
                                                     String documentNumber, LocalDate issueDate, Long issuingOfficeId,
                                                     String previousNationality, LocalDate naturalizationDate,
                                                     @NotBlank String decreeNumber, LocalDate decreeDate) {}

    public record NaturalizationRecordDto(DocumentDto document, String previousNationality,
                                           LocalDate naturalizationDate, String decreeNumber, LocalDate decreeDate,
                                           String status) {}

    // ---- name change records -----------------------------------------------
    public record CreateNameChangeRecordRequest(@NotNull Long citizenId, @NotNull Long documentTypeId,
                                                 String documentNumber, LocalDate issueDate, Long issuingOfficeId,
                                                 Long amendmentId, String oldFirstName, String oldMiddleName,
                                                 String oldLastName, @NotBlank String newFirstName,
                                                 String newMiddleName, String newLastName, String reason,
                                                 String courtDecisionNumber, LocalDate changeDate) {}

    public record NameChangeRecordDto(DocumentDto document, Long amendmentId, String oldFirstName,
                                       String newFirstName, String reason, LocalDate changeDate) {}
}
