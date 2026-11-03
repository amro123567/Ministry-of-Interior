package com.moi.cts.controller;

import com.moi.cts.audit.Audited;
import com.moi.cts.dto.RequestFinanceDtos.*;
import com.moi.cts.entity.SlaStatus;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.RequestFinanceService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Persisted SLA snapshots and payments (ERD domain 7) -- see
 * {@code RequestFinanceService}'s Javadoc for what this does and
 * deliberately does not add (request assignments). Kept as a separate
 * controller from the existing {@code SlaController} (live SLA lists)
 * rather than folded into it, so that controller's own documented
 * "live-computed, not persisted" design stays visibly unchanged.
 *
 * <p>Permission model, added alongside this controller's first frontend
 * consumer (the request detail page's SLA/payments panel, frontend
 * integration pass Step 7): the SLA reads and refresh stay ungated, like
 * every other read in this migration -- refreshing only recomputes an
 * already-visible derived value, so gating it would add nothing. Recording
 * a payment ({@code PAYMENT_RECORD}) and reversing one
 * ({@code PAYMENT_REVERSE}) are gated separately in {@code SecurityConfig},
 * the same "front-line action vs. correction authority" split already used
 * for {@code CITIZEN_MANAGE}/{@code CITIZEN_REGISTRY_DECIDE} and
 * {@code REQUEST_TRANSITION_SUBMIT}/{@code DECIDE} -- see those two
 * permissions' own Javadoc in {@code DataSeeder} for why OFFICER is granted
 * only the first.
 */
@RestController
public class RequestFinanceController {

    private final RequestFinanceService requestFinanceService;

    public RequestFinanceController(RequestFinanceService requestFinanceService) {
        this.requestFinanceService = requestFinanceService;
    }

    @GetMapping("/api/sla-records/{requestId}")
    public SlaRecordDto getSlaRecord(@PathVariable Long requestId) {
        return requestFinanceService.getSlaRecord(requestId);
    }

    @PostMapping("/api/sla-records/{requestId}/refresh")
    @Audited(entityType = "SlaRecord", action = "REFRESH")
    public SlaRecordDto refreshSlaRecord(@PathVariable Long requestId) {
        return requestFinanceService.refreshSlaRecord(requestId);
    }

    @GetMapping("/api/sla-records")
    public List<SlaRecordDto> listSlaRecords(@RequestParam SlaStatus status) {
        return requestFinanceService.listSlaRecordsByStatus(status);
    }

    @PostMapping("/api/payments")
    @Audited(entityType = "Payment", action = "RECORD")
    public PaymentDto recordPayment(@Valid @RequestBody RecordPaymentRequest request,
                                     @AuthenticationPrincipal AppUserPrincipal actor) {
        return requestFinanceService.recordPayment(request, actor);
    }

    @PatchMapping("/api/payments/{id}/reverse")
    @Audited(entityType = "Payment", action = "REVERSE")
    public PaymentDto reversePayment(@PathVariable Long id, @Valid @RequestBody ReversePaymentRequest request,
                                      @AuthenticationPrincipal AppUserPrincipal actor) {
        return requestFinanceService.reversePayment(id, request, actor);
    }

    @GetMapping("/api/requests/{requestId}/payments")
    public List<PaymentDto> paymentsForRequest(@PathVariable Long requestId) {
        return requestFinanceService.paymentsForRequest(requestId);
    }
}
