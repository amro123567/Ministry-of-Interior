package com.moi.cts.controller;

import com.moi.cts.dto.MiscDtos.AuditEntryDto;
import com.moi.cts.service.AuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/api/audit")
    public List<AuditEntryDto> audit(@RequestParam(required = false) String entityType,
                                      @RequestParam(required = false) Long entityId) {
        if (entityType != null && entityId != null) {
            return auditService.forEntity(entityType, entityId);
        }
        return auditService.recent();
    }
}
