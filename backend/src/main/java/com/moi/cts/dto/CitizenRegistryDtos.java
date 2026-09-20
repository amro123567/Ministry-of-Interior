package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

/**
 * DTOs for the citizen-registry domain built on top of the base
 * {@link CitizenDtos} record: family records/membership, guardianship,
 * registry transfers, and civil-status amendments (ERD domain 5).
 */
public class CitizenRegistryDtos {

    // ---- family records / membership --------------------------------
    // familyRecordId lets the frontend link from a citizen's own family
    // history (GET /api/citizens/{id}/family-history, which returns these
    // across every family they've ever belonged to) to that family
    // record's own page (GET /api/family-records/{familyRecordId}) --
    // without it, a membership row was a dead end with no way back to the
    // record it came from.
    public record FamilyMemberDto(Long id, Long familyRecordId, Long citizenId, String citizenName,
                                   String relationship, LocalDate joinedDate, LocalDate leftDate, String leftReason) {}

    public record FamilyRecordDto(Long id, String familyBookNumber, Long headOfHouseholdId,
                                   String headOfHouseholdName, Long registrationOfficeId, boolean active,
                                   List<FamilyMemberDto> members) {}

    public record CreateFamilyRecordRequest(@NotBlank String familyBookNumber,
                                             @NotNull Long headOfHouseholdId, Long registrationOfficeId) {}

    public record AddFamilyMemberRequest(@NotNull Long citizenId, @NotBlank String relationship,
                                          LocalDate joinedDate) {}

    public record LeaveFamilyMemberRequest(@NotBlank String leftReason, LocalDate leftDate) {}

    // ---- guardianship --------------------------------------------------
    public record GuardianshipDto(Long id, Long minorCitizenId, String minorName, Long guardianCitizenId,
                                   String guardianName, String guardianshipType, String courtDecisionNumber,
                                   Long courtId, String courtName, LocalDate startDate, LocalDate endDate,
                                   String status) {}

    public record CreateGuardianshipRequest(@NotNull Long minorCitizenId, @NotNull Long guardianCitizenId,
                                             @NotBlank String guardianshipType, @NotBlank String courtDecisionNumber,
                                             @NotNull Long courtId, @NotNull LocalDate startDate,
                                             LocalDate endDate) {}

    // ---- registry transfers ---------------------------------------------
    public record RegistryTransferDto(Long id, Long citizenId, String citizenName, Long fromOfficeId,
                                       String fromOfficeName, Long toOfficeId, String toOfficeName,
                                       String requestedByName, Instant requestedAt, String approvedByName,
                                       Instant approvedAt, String decisionReference, String status,
                                       LocalDate transferDate) {}

    public record RequestTransferRequest(@NotNull Long citizenId, @NotNull Long toOfficeId,
                                          LocalDate transferDate) {}

    // decision: "APPROVE" or "REJECT"
    public record DecideTransferRequest(@NotBlank String decision, String decisionReference) {}

    // ---- civil status amendments -----------------------------------------
    public record CivilStatusAmendmentDto(Long id, Long citizenId, String citizenName, String fieldChanged,
                                           String oldValue, String newValue, String legalBasis,
                                           String courtDecisionNumber, Long courtId, String requestedByName,
                                           String approvedByName, Instant approvedAt, LocalDate amendmentDate,
                                           String status) {}

    public record RequestAmendmentRequest(@NotNull Long citizenId, @NotBlank String fieldChanged, String oldValue,
                                           @NotBlank String newValue, @NotBlank String legalBasis,
                                           String courtDecisionNumber, Long courtId, LocalDate amendmentDate) {}

    // decision: "APPROVE" or "REJECT"
    public record DecideAmendmentRequest(@NotBlank String decision) {}
}
