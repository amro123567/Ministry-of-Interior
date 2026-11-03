package com.moi.cts.repository;

import com.moi.cts.entity.AuditLogEntry;
import java.util.List;

public interface AuditLogRepository extends AppendOnlyRepository<AuditLogEntry, Long> {
    List<AuditLogEntry> findByEntityTypeAndEntityIdOrderByOccurredAtDesc(String entityType, Long entityId);
    List<AuditLogEntry> findTop50ByOrderByOccurredAtDesc();
}
