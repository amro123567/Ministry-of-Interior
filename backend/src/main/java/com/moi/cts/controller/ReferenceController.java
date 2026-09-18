package com.moi.cts.controller;

import com.moi.cts.service.ReferenceDataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReferenceController {

    private final ReferenceDataService referenceDataService;

    public ReferenceController(ReferenceDataService referenceDataService) {
        this.referenceDataService = referenceDataService;
    }

    @GetMapping("/api/offices")
    public Object offices() { return referenceDataService.offices(); }

    @GetMapping("/api/document-types")
    public Object documentTypes() { return referenceDataService.documentTypes(); }

    @GetMapping("/api/roles")
    public Object roles() { return referenceDataService.roles(); }
}
