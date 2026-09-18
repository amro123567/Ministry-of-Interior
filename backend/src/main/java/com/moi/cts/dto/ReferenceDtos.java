package com.moi.cts.dto;

public class ReferenceDtos {
    public record OfficeDto(Long id, String code, String nameEn, String nameAr) {}
    public record DocumentTypeDto(Long id, String code, String nameEn, String nameAr, int slaDays) {}
    public record RoleDto(Long id, String name, String description) {}
}
