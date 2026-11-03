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

    // Flat {id, code, description} list -- RoleDto above only nests
    // permission *codes* per role, which isn't enough for a picker that
    // needs ids (e.g. workflow-transition creation's requiredPermissionIds).
    @GetMapping("/api/permissions")
    public Object permissions() { return referenceDataService.permissions(); }

    // ---- reference & organizational hierarchy --------------------------
    @GetMapping("/api/governorates")
    public Object governorates() { return referenceDataService.governorates(); }

    @GetMapping("/api/districts")
    public Object districts() { return referenceDataService.districts(); }

    @GetMapping("/api/departments")
    public Object departments() { return referenceDataService.departments(); }

    @GetMapping("/api/courts")
    public Object courts() { return referenceDataService.courts(); }

    @GetMapping("/api/religious-authorities")
    public Object religiousAuthorities() { return referenceDataService.religiousAuthorities(); }

    @GetMapping("/api/mukhtars")
    public Object mukhtars() { return referenceDataService.mukhtars(); }
}
