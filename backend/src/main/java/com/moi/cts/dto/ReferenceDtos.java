package com.moi.cts.dto;

import java.time.LocalDate;
import java.util.List;

public class ReferenceDtos {
    // districtId is nullable -- existing offices predate the reference/org
    // hierarchy and aren't required to have one (see Office.district's
    // Javadoc).
    public record OfficeDto(Long id, String code, String nameEn, String nameAr, Long districtId) {}
    public record DocumentTypeDto(Long id, String code, String nameEn, String nameAr, int slaDays) {}
    public record RoleDto(Long id, String name, String description, List<String> permissions) {}
    // RoleDto above only ever exposes permission *codes* nested per role --
    // there was no endpoint returning the flat {id, code} pairs a picker
    // needs (e.g. workflow-transition creation's requiredPermissionIds,
    // which takes ids, not codes). Added alongside the workflow-engine UI
    // for exactly that; open read like every other reference endpoint.
    public record PermissionDto(Long id, String code, String description) {}

    // ---- reference & organizational hierarchy (governorates -> districts,
    // departments, courts, religious authorities, mukhtars) ----------------
    public record GovernorateDto(Long id, String code, String nameEn, String nameAr, boolean active) {}
    public record DistrictDto(Long id, Long governorateId, String code, String nameEn, String nameAr, boolean active) {}
    public record DepartmentDto(Long id, Long parentId, String code, String nameEn, String nameAr,
                                 String description, boolean active) {}
    public record CourtDto(Long id, Long districtId, String nameEn, String nameAr, String courtType,
                            String jurisdiction, boolean active) {}
    public record ReligiousAuthorityDto(Long id, String nameEn, String nameAr, String religion, String sect,
                                         boolean active) {}
    public record MukhtarDto(Long id, Long districtId, String firstNameEn, String lastNameEn, String firstNameAr,
                              String lastNameAr, String villageOrNeighborhood, String phone, String email,
                              LocalDate termStart, LocalDate termEnd, boolean active) {}
}
