package com.moi.cts.controller;

import com.moi.cts.audit.Audited;
import com.moi.cts.dto.CitizenRegistryDtos.*;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.CitizenRegistryService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Family records/membership, guardianship, registry transfers, and civil-
 * status amendments -- everything in ERD domain 5 except {@code citizens}
 * itself, which stays on {@code CitizenController}. No dedicated
 * permission gate yet (falls under {@code anyRequest().authenticated()}
 * like the reference endpoints) -- a future item can narrow this once the
 * frontend screens that will actually call these exist and it's clear
 * which roles should.
 */
@RestController
public class CitizenRegistryController {

    private final CitizenRegistryService registryService;

    public CitizenRegistryController(CitizenRegistryService registryService) {
        this.registryService = registryService;
    }

    // ---- family records / membership ------------------------------------
    @PostMapping("/api/family-records")
    @Audited(entityType = "FamilyRecord", action = "CREATE")
    public FamilyRecordDto createFamilyRecord(@Valid @RequestBody CreateFamilyRecordRequest request,
                                               @AuthenticationPrincipal AppUserPrincipal actor) {
        return registryService.createFamilyRecord(request, actor);
    }

    @GetMapping("/api/family-records/{id}")
    public FamilyRecordDto getFamilyRecord(@PathVariable Long id) {
        return registryService.getFamilyRecord(id);
    }

    @PostMapping("/api/family-records/{id}/members")
    @Audited(entityType = "FamilyRecord", action = "ADD_MEMBER")
    public FamilyMemberDto addFamilyMember(@PathVariable Long id, @Valid @RequestBody AddFamilyMemberRequest request) {
        return registryService.addFamilyMember(id, request);
    }

    @PatchMapping("/api/family-records/{id}/members/{memberId}/leave")
    @Audited(entityType = "FamilyRecord", action = "MEMBER_LEFT")
    public FamilyMemberDto leaveFamilyMember(@PathVariable Long id, @PathVariable Long memberId,
                                              @Valid @RequestBody LeaveFamilyMemberRequest request) {
        return registryService.leaveFamilyMember(id, memberId, request);
    }

    @GetMapping("/api/citizens/{citizenId}/family-history")
    public List<FamilyMemberDto> familyHistory(@PathVariable Long citizenId) {
        return registryService.familyHistoryForCitizen(citizenId);
    }

    // ---- guardianship -----------------------------------------------------
    @PostMapping("/api/guardianships")
    @Audited(entityType = "GuardianshipRecord", action = "CREATE")
    public GuardianshipDto createGuardianship(@Valid @RequestBody CreateGuardianshipRequest request,
                                               @AuthenticationPrincipal AppUserPrincipal actor) {
        return registryService.createGuardianship(request, actor);
    }

    @GetMapping("/api/citizens/{citizenId}/guardians")
    public List<GuardianshipDto> activeGuardians(@PathVariable Long citizenId) {
        return registryService.activeGuardiansOf(citizenId);
    }

    // ---- registry transfers -----------------------------------------------
    @PostMapping("/api/registry-transfers")
    @Audited(entityType = "RegistryTransfer", action = "CREATE")
    public RegistryTransferDto requestTransfer(@Valid @RequestBody RequestTransferRequest request,
                                                @AuthenticationPrincipal AppUserPrincipal actor) {
        return registryService.requestTransfer(request, actor);
    }

    @PatchMapping("/api/registry-transfers/{id}/decide")
    @Audited(entityType = "RegistryTransfer", action = "DECIDE")
    public RegistryTransferDto decideTransfer(@PathVariable Long id, @Valid @RequestBody DecideTransferRequest request,
                                               @AuthenticationPrincipal AppUserPrincipal actor) {
        return registryService.decideTransfer(id, request, actor);
    }

    @GetMapping("/api/citizens/{citizenId}/registry-transfers")
    public List<RegistryTransferDto> transfersForCitizen(@PathVariable Long citizenId) {
        return registryService.transfersForCitizen(citizenId);
    }

    // ---- civil status amendments ------------------------------------------
    @PostMapping("/api/civil-status-amendments")
    @Audited(entityType = "CivilStatusAmendment", action = "CREATE")
    public CivilStatusAmendmentDto requestAmendment(@Valid @RequestBody RequestAmendmentRequest request,
                                                     @AuthenticationPrincipal AppUserPrincipal actor) {
        return registryService.requestAmendment(request, actor);
    }

    @PatchMapping("/api/civil-status-amendments/{id}/decide")
    @Audited(entityType = "CivilStatusAmendment", action = "DECIDE")
    public CivilStatusAmendmentDto decideAmendment(@PathVariable Long id,
                                                    @Valid @RequestBody DecideAmendmentRequest request,
                                                    @AuthenticationPrincipal AppUserPrincipal actor) {
        return registryService.decideAmendment(id, request, actor);
    }

    @GetMapping("/api/citizens/{citizenId}/civil-status-amendments")
    public List<CivilStatusAmendmentDto> amendmentsForCitizen(@PathVariable Long citizenId) {
        return registryService.amendmentsForCitizen(citizenId);
    }
}
