package com.moi.cts.repository;

import com.moi.cts.entity.SlaRecord;
import com.moi.cts.entity.SlaStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SlaRecordRepository extends JpaRepository<SlaRecord, Long> {
    Optional<SlaRecord> findByRequestId(Long requestId);
    List<SlaRecord> findBySlaStatus(SlaStatus slaStatus);
}
