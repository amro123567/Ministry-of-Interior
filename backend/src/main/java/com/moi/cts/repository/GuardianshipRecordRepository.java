package com.moi.cts.repository;

import com.moi.cts.entity.GuardianshipRecord;
import com.moi.cts.entity.GuardianshipStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GuardianshipRecordRepository extends JpaRepository<GuardianshipRecord, Long> {
    // "who is this minor's guardian" -- the primary query per the design
    // docs' own index rationale for this table.
    List<GuardianshipRecord> findByMinorCitizenIdAndStatus(Long minorCitizenId, GuardianshipStatus status);

    List<GuardianshipRecord> findByMinorCitizenId(Long minorCitizenId);
}
