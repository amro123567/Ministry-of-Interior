package com.moi.cts.dto;

import java.time.Instant;

/**
 * DTOs for Item 6's two new logging tiers: field-level citizen changes
 * ({@link com.moi.cts.entity.CitizenAuditLog}) and citizen-record reads
 * ({@link com.moi.cts.entity.RecordAccessLog}). Tier 1 (the general
 * action log) already has its own DTO ({@code MiscDtos.AuditEntryDto})
 * and is unchanged by this item.
 */
public class CitizenAuditDtos {

    public record CitizenAuditLogDto(Long id, Long citizenId, String citizenRegistryNumber, Long amendmentId,
                                      String fieldName, String oldValue, String newValue, Long changedById,
                                      String changedByName, Instant changedAt, String reason, String ipAddress) {}

    public record RecordAccessLogDto(Long id, Long citizenId, String citizenRegistryNumber, Long accessedById,
                                      String accessedByName, String accessType, Instant accessedAt, String reason,
                                      String ipAddress) {}
}
