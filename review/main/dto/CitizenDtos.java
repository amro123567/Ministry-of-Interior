package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public class CitizenDtos {

    public record CitizenDto(Long id, String registryNumber, String firstNameEn, String middleNameEn,
                              String lastNameEn, String firstNameAr, String middleNameAr, String lastNameAr,
                              LocalDate dateOfBirth, String placeOfBirth, String gender, String religion,
                              String sect, String maritalStatus, String sijillReference, String nationality,
                              boolean deceased, String officeName, Long fatherId, String fatherName,
                              Long motherId, String motherName, String fatherNameUnregistered,
                              String motherNameUnregistered) {}

    public record CreateCitizenRequest(@NotBlank String registryNumber, @NotBlank String firstNameEn,
                                        String middleNameEn, String lastNameEn, String firstNameAr,
                                        String middleNameAr, String lastNameAr, LocalDate dateOfBirth,
                                        String placeOfBirth, String gender, String religion, String sect,
                                        String maritalStatus, String sijillReference, String nationality,
                                        Long officeId, Long fatherId, String fatherNameUnregistered,
                                        Long motherId, String motherNameUnregistered) {}

    // PATCH /api/citizens/{id}/lineage -- links (or corrects) father/mother
    // after both records already exist, e.g. a child registered before a
    // parent's own registry number was known. Every field is nullable and
    // independently optional: pass null for a side you don't want to touch.
    public record LineageUpdateRequest(Long fatherId, String fatherNameUnregistered,
                                        Long motherId, String motherNameUnregistered) {}
}
