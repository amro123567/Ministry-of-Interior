package com.moi.cts.repository;

import com.moi.cts.entity.RecordAccessLog;

import java.util.List;

public interface RecordAccessLogRepository extends AppendOnlyRepository<RecordAccessLog, Long> {
    List<RecordAccessLog> findByCitizenIdOrderByAccessedAtDesc(Long citizenId);
    List<RecordAccessLog> findByAccessedByIdOrderByAccessedAtDesc(Long accessedById);
}
