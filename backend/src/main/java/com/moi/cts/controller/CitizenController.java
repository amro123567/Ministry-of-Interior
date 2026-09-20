package com.moi.cts.controller;

import com.moi.cts.audit.Audited;
import com.moi.cts.dto.CitizenDtos.*;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.CitizenService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/citizens")
public class CitizenController {

    private final CitizenService citizenService;

    public CitizenController(CitizenService citizenService) {
        this.citizenService = citizenService;
    }

    @GetMapping
    public List<CitizenDto> search(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) String reason,
                                    @AuthenticationPrincipal AppUserPrincipal actor) {
        List<CitizenDto> results = citizenService.search(q);
        // Item 6, tier 3: one record-access-log row per citizen actually
        // returned -- see RecordAccessLog's Javadoc for why this
        // (deliberately, per the SDD's own accepted trade-off) makes this
        // the highest-volume write path in the new logging domain.
        for (CitizenDto dto : results) {
            citizenService.logSearchAccess(dto.id(), actor, reason);
        }
        return results;
    }

    @GetMapping("/{id}")
    public CitizenDto get(@PathVariable Long id, @RequestParam(required = false) String reason,
                           @AuthenticationPrincipal AppUserPrincipal actor) {
        CitizenDto dto = citizenService.get(id);
        citizenService.logRecordAccess(id, actor, reason);
        return dto;
    }

    @PostMapping
    @Audited(entityType = "Citizen", action = "CREATE")
    public ResponseEntity<CitizenDto> create(@Valid @RequestBody CreateCitizenRequest request,
                                              @AuthenticationPrincipal AppUserPrincipal actor) {
        return ResponseEntity.ok(citizenService.create(request, actor));
    }

    @PatchMapping("/{id}/lineage")
    @Audited(entityType = "Citizen", action = "LINEAGE_UPDATE")
    public CitizenDto updateLineage(@PathVariable Long id, @Valid @RequestBody LineageUpdateRequest request,
                                     @AuthenticationPrincipal AppUserPrincipal actor) {
        return citizenService.updateLineage(id, request, actor);
    }
}
