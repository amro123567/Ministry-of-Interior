package com.moi.cts.dto;

import java.util.List;

public class DocumentTypeAuthorityDtos {
    public record DocumentTypeAuthoritiesDto(Long documentTypeId, String documentTypeCode, List<String> authorities) {}
}
