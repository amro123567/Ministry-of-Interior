package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public class CitizenDtos {

    public record CitizenDto(Long id, String registryNumber, String firstNameEn, String lastNameEn,
                              String firstNameAr, String lastNameAr, LocalDate dateOfBirth,
                              String gender, String officeName) {}

    public record CreateCitizenRequest(@NotBlank String registryNumber, @NotBlank String firstNameEn,
                                        String lastNameEn, String firstNameAr, String lastNameAr,
                                        LocalDate dateOfBirth, String gender, Long officeId) {}
}
