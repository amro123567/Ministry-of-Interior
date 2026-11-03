package com.moi.cts.repository;

import com.moi.cts.entity.NameChangeRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NameChangeRecordRepository extends JpaRepository<NameChangeRecord, Long> {
}
