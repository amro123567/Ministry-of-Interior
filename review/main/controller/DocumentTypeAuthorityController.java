package com.moi.cts.controller;

import com.moi.cts.dto.DocumentTypeAuthorityDtos.DocumentTypeAuthoritiesDto;
import com.moi.cts.service.DocumentTypeAuthorityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** Read-only: which kinds of authority may authorise a document type. Any signed-in user. */
@RestController
public class DocumentTypeAuthorityController {

    private final DocumentTypeAuthorityService service;

    public DocumentTypeAuthorityController(DocumentTypeAuthorityService service) {
        this.service = service;
    }

    @GetMapping("/api/document-types/{id}/authorities")
    public DocumentTypeAuthoritiesDto authorities(@PathVariable Long id) {
        return service.forType(id);
    }
}
