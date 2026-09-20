package com.moi.cts.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class MiscDtos {

    public record AttachmentDto(Long id, String fileName, String contentType, long sizeBytes,
                                 String sha256, String uploadedByName, Instant uploadedAt) {}

    public record AuditEntryDto(Long id, String entityType, Long entityId, String action,
                                 String actorName, String details, Instant occurredAt) {}

    public record DashboardSummaryDto(long total, Map<String, Long> byStatus, long overdueCount,
                                       long dueSoonCount, long closedThisWeek, double avgResolutionHours) {}

    public record ThroughputPointDto(String periodLabel, long created, long closed) {}

    public record AgingBucketDto(String bucket, long count) {}

    public record DocumentTypeBreakdownDto(String documentTypeName, long total, double avgResolutionHours) {}

    public record OfficeBreakdownDto(String officeName, long total, long overdueCount) {}

    public record ReportsSummaryDto(List<ThroughputPointDto> throughput, List<AgingBucketDto> aging,
                                     List<DocumentTypeBreakdownDto> byDocumentType,
                                     List<OfficeBreakdownDto> byOffice, double slaBreachRate) {}

    public record ApiError(String message, Instant timestamp) {
        public ApiError(String message) { this(message, Instant.now()); }
    }
}
