package com.moi.cts.repository;

import com.moi.cts.entity.RecordAccessLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecordAccessLogRepository extends JpaRepository<RecordAccessLog, Long> {
    List<RecordAccessLog> findByCitizenIdOrderByAccessedAtDesc(Long citizenId);
    List<RecordAccessLog> findByAccessedByIdOrderByAccessedAtDesc(Long accessedById);
}
