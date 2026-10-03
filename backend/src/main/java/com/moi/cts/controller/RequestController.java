package com.moi.cts.controller;

import com.moi.cts.dto.RequestDtos.*;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.RequestService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/requests")
public class RequestController {

    private final RequestService requestService;

    public RequestController(RequestService requestService) {
        this.requestService = requestService;
    }

    @GetMapping
    public List<RequestSummaryDto> list(@RequestParam(required = false) String status,
                                         @RequestParam(required = false) String search,
                                         @RequestParam(required = false) Boolean assignedToMe,
                                         @RequestParam(required = false) Long officeId,
                                         @RequestParam(required = false) String priority,
                                         @RequestParam(required = false) String direction,
                                         @RequestParam(required = false) String sla,
                                         @RequestParam(required = false)
                                         @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                         @RequestParam(required = false)
                                         @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                         @AuthenticationPrincipal AppUserPrincipal actor) {
        return requestService.list(new RequestFilter(status, search, assignedToMe, officeId,
                priority, direction, sla, from, to), actor != null ? actor.getId() : null);
    }

    @GetMapping("/{id}")
    public RequestDetailDto get(@PathVariable Long id) { return requestService.get(id); }

    @GetMapping("/{id}/history")
    public List<HistoryDto> history(@PathVariable Long id) { return requestService.history(id); }

    @GetMapping("/{id}/assignments")
    public List<AssignmentHistoryDto> assignments(@PathVariable Long id) { return requestService.assignmentHistory(id); }

    @PostMapping
    public ResponseEntity<RequestDetailDto> create(@Valid @RequestBody CreateRequestRequest request,
                                                     @AuthenticationPrincipal AppUserPrincipal actor) {
        return ResponseEntity.ok(requestService.create(request, actor));
    }

    @PatchMapping("/{id}/assign")
    public RequestDetailDto assign(@PathVariable Long id, @Valid @RequestBody AssignRequest request,
                                    @AuthenticationPrincipal AppUserPrincipal actor) {
        return requestService.assign(id, request, actor);
    }

    @PatchMapping("/{id}/transition")
    public RequestDetailDto transition(@PathVariable Long id, @Valid @RequestBody TransitionRequest request,
                                        @AuthenticationPrincipal AppUserPrincipal actor) {
        return requestService.transition(id, request, actor);
    }
}
