package com.moi.cts.repository;

import com.moi.cts.entity.AuditLogEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, Long> {
    List<AuditLogEntry> findByEntityTypeAndEntityIdOrderByOccurredAtDesc(String entityType, Long entityId);
    List<AuditLogEntry> findTop50ByOrderByOccurredAtDesc();
}
