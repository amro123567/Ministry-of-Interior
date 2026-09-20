package com.moi.cts.repository;

import com.moi.cts.entity.NaturalizationRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NaturalizationRecordRepository extends JpaRepository<NaturalizationRecord, Long> {
}
