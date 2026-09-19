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
    public List<CitizenDto> search(@RequestParam(required = false) String q) {
        return citizenService.search(q);
    }

    @GetMapping("/{id}")
    public CitizenDto get(@PathVariable Long id) { return citizenService.get(id); }

    @PostMapping
    @Audited(entityType = "Citizen", action = "CREATE")
    public ResponseEntity<CitizenDto> create(@Valid @RequestBody CreateCitizenRequest request,
                                              @AuthenticationPrincipal AppUserPrincipal actor) {
        return ResponseEntity.ok(citizenService.create(request));
    }
}
