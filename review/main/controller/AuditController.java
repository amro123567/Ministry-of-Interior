package com.moi.cts.controller;

import com.moi.cts.dto.MiscDtos.AuditEntryDto;
import com.moi.cts.service.AuditService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

@RestController
public class AuditController {

    private static final int DEFAULT_LIMIT = 200;
    private static final int MAX_LIMIT = 1000;

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    /**
     * With entityType + entityId: that entity's history. Otherwise the whole log,
     * newest first, narrowed by any of q / entityType / action / from / to.
     */
    @GetMapping("/api/audit")
    public List<AuditEntryDto> audit(@RequestParam(required = false) String entityType,
                                      @RequestParam(required = false) Long entityId,
                                      @RequestParam(required = false) String q,
                                      @RequestParam(required = false) String action,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) Integer limit) {
        if (entityType != null && entityId != null) {
            return auditService.forEntity(entityType, entityId);
        }
        int capped = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
        return auditService.search(q, entityType, action, startOf(from), endOf(to), capped);
    }

    @GetMapping("/api/audit/facets")
    public AuditService.AuditFacets facets() {
        return auditService.facets();
    }

    @GetMapping("/api/audit/export")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String entityType,
                                         @RequestParam(required = false) String q,
                                         @RequestParam(required = false) String action,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=audit_log.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(auditService.searchCsv(q, entityType, action, startOf(from), endOf(to)));
    }

    private static Instant startOf(LocalDate d) {
        return d == null ? null : d.atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    /** Exclusive upper bound: the whole "to" day is included. */
    private static Instant endOf(LocalDate d) {
        return d == null ? null : d.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}
