package com.moi.cts.controller;

import com.moi.cts.dto.DocumentReviewDtos.*;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.DocumentReviewService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * Validation sign-offs and physical custody for a document. Reading is open to any
 * authenticated user. Recording custody needs CITIZEN_MANAGE (the existing
 * POST /api/documents/** matcher); validating needs CITIZEN_REGISTRY_DECIDE (a more
 * specific matcher placed before it in SecurityConfig).
 */
@RestController
public class DocumentReviewController {

    private final DocumentReviewService service;

    public DocumentReviewController(DocumentReviewService service) {
        this.service = service;
    }

    @GetMapping("/api/documents/{id}/review")
    public DocumentReviewDto review(@PathVariable Long id) {
        return service.review(id);
    }

    @PostMapping("/api/documents/{id}/validations")
    public ValidationDto validate(@PathVariable Long id, @Valid @RequestBody ValidateDocumentRequest request,
                                  @AuthenticationPrincipal AppUserPrincipal actor) {
        return service.validate(id, request, actor);
    }

    @PostMapping("/api/documents/{id}/custody")
    public CustodyEventDto recordCustody(@PathVariable Long id, @Valid @RequestBody RecordCustodyRequest request,
                                         @AuthenticationPrincipal AppUserPrincipal actor) {
        return service.recordCustody(id, request, actor);
    }
}
