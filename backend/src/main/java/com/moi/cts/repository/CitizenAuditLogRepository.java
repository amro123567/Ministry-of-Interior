package com.moi.cts.repository;

import com.moi.cts.entity.CitizenAuditLog;

import java.util.List;

public interface CitizenAuditLogRepository extends AppendOnlyRepository<CitizenAuditLog, Long> {
    List<CitizenAuditLog> findByCitizenIdOrderByChangedAtDesc(Long citizenId);
    List<CitizenAuditLog> findByChangedByIdOrderByChangedAtDesc(Long changedById);
}
