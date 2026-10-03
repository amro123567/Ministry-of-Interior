package com.moi.cts.dto;

import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;

public class RequestDtos {

    /** Optional search filters for the request list; any field may be null. */
    public record RequestFilter(String status, String search, Boolean assignedToMe, Long officeId,
                                String priority, String direction, String sla,
                                LocalDate from, LocalDate to) {}

    public record RequestSummaryDto(Long id, String referenceNumber, String citizenName,
                                     String documentTypeName, String status, String priority,
                                     String assignedToName, Instant dueAt, boolean overdue,
                                     String slaStatus, Instant createdAt,
                                     String direction, String subject) {}

    public record RequestDetailDto(Long id, String referenceNumber, CitizenDtos.CitizenDto citizen,
                                    ReferenceDtos.DocumentTypeDto documentType, ReferenceDtos.OfficeDto office,
                                    String assignedToName, Long assignedToId, String createdByName,
                                    String status, String priority, String notes, String rejectionReason,
                                    Instant createdAt, Instant submittedAt, Instant dueAt, Instant closedAt,
                                    boolean overdue, String slaStatus, Instant breachedAt,
                                    String direction, String subject, Long departmentId, String departmentName) {}

    public record CreateRequestRequest(@NotNull Long citizenId, @NotNull Long documentTypeId,
                                        @NotNull Long officeId, String priority, String notes,
                                        String direction,
                                        @jakarta.validation.constraints.Size(max = 255) String subject,
                                        Long departmentId) {}

    public record TransitionRequest(@NotNull String toStatus, String note, String rejectionReason) {}

    public record AssignRequest(@NotNull Long userId, String note) {}

    public record HistoryDto(Long id, String fromStatus, String toStatus, String changedByName,
                              String note, Instant changedAt) {}

    public record AssignmentHistoryDto(Long id, String assignedToName, String assignedByName,
                                        String note, Instant assignedAt) {}
}
