package com.moi.cts.controller;

import com.moi.cts.dto.CitizenAuditDtos.CitizenAuditLogDto;
import com.moi.cts.dto.CitizenAuditDtos.RecordAccessLogDto;
import com.moi.cts.service.CitizenAuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read endpoints for Item 6's two new logging tiers. Nested under
 * {@code /api/audit/**} on purpose -- that path is already gated by
 * {@code hasAuthority("AUDIT_VIEW")} in {@code SecurityConfig}, so these
 * new endpoints inherit the same permission gate with no security-config
 * change needed, the same way every reference/registry endpoint added
 * this migration reuses existing infrastructure rather than duplicating
 * it.
 */
@RestController
public class CitizenAuditController {

    private final CitizenAuditService citizenAuditService;

    public CitizenAuditController(CitizenAuditService citizenAuditService) {
        this.citizenAuditService = citizenAuditService;
    }

    @GetMapping("/api/audit/citizen/{citizenId}")
    public List<CitizenAuditLogDto> changeHistory(@PathVariable Long citizenId) {
        return citizenAuditService.changeHistoryForCitizen(citizenId);
    }

    @GetMapping("/api/audit/access/citizen/{citizenId}")
    public List<RecordAccessLogDto> accessHistoryForCitizen(@PathVariable Long citizenId) {
        return citizenAuditService.accessHistoryForCitizen(citizenId);
    }

    @GetMapping("/api/audit/access/user/{userId}")
    public List<RecordAccessLogDto> accessHistoryByUser(@PathVariable Long userId) {
        return citizenAuditService.accessHistoryByUser(userId);
    }
}
