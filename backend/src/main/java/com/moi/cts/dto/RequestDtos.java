package com.moi.cts.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public class RequestDtos {

    public record RequestSummaryDto(Long id, String referenceNumber, String citizenName,
                                     String documentTypeName, String status, String priority,
                                     String assignedToName, Instant dueAt, boolean overdue,
                                     Instant createdAt) {}

    public record RequestDetailDto(Long id, String referenceNumber, CitizenDtos.CitizenDto citizen,
                                    ReferenceDtos.DocumentTypeDto documentType, ReferenceDtos.OfficeDto office,
                                    String assignedToName, Long assignedToId, String createdByName,
                                    String status, String priority, String notes, String rejectionReason,
                                    Instant createdAt, Instant submittedAt, Instant dueAt, Instant closedAt,
                                    boolean overdue) {}

    public record CreateRequestRequest(@NotNull Long citizenId, @NotNull Long documentTypeId,
                                        @NotNull Long officeId, String priority, String notes) {}

    public record TransitionRequest(@NotNull String toStatus, String note, String rejectionReason) {}

    public record AssignRequest(@NotNull Long userId) {}

    public record HistoryDto(Long id, String fromStatus, String toStatus, String changedByName,
                              String note, Instant changedAt) {}
}
