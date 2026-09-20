package com.moi.cts.repository;

import com.moi.cts.entity.CitizenAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CitizenAuditLogRepository extends JpaRepository<CitizenAuditLog, Long> {
    List<CitizenAuditLog> findByCitizenIdOrderByChangedAtDesc(Long citizenId);
    List<CitizenAuditLog> findByChangedByIdOrderByChangedAtDesc(Long changedById);
}
