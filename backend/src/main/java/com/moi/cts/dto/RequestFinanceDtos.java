package com.moi.cts.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * DTOs for the "full service-request model" half of ERD domain 7 this
 * item adds: persisted SLA snapshots ({@link com.moi.cts.entity.SlaRecord})
 * and payments ({@link com.moi.cts.entity.Payment}). Request assignments
 * -- the domain's third named piece -- are deliberately NOT duplicated
 * here; see {@code RequestFinanceService}'s package-level note for why
 * the existing {@code assignedToId}/{@code RequestAssignmentHistory}
 * design already satisfies that requirement.
 */
public class RequestFinanceDtos {

    public record SlaRecordDto(Long id, Long requestId, String referenceNumber, LocalDate dueDate, String slaStatus,
                                Integer daysRemaining, Integer overdueByDays, Instant breachedAt,
                                Instant lastCheckedAt) {}

    public record PaymentDto(Long id, Long requestId, String referenceNumber, BigDecimal amount, String currency,
                              String method, String status, String receiptNumber, Long collectedById,
                              String collectedByName, Instant paidAt, Long reversedById, String reversedByName,
                              Instant reversedAt, String reversalReason) {}

    public record RecordPaymentRequest(@NotNull Long requestId, @NotNull @DecimalMin("0.01") BigDecimal amount,
                                        @NotBlank String currency, @NotBlank String method, String receiptNumber) {}

    public record ReversePaymentRequest(@NotBlank String reversalReason) {}
}
