package com.moi.cts.repository;

import com.moi.cts.entity.CorrespondenceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface CorrespondenceRequestRepository
        extends JpaRepository<CorrespondenceRequest, Long>, JpaSpecificationExecutor<CorrespondenceRequest> {

    /**
     * Loads a request and locks its row until the surrounding transaction ends, so two people
     * cannot change the same request at once (e.g. one approving while another rejects).
     * The second caller waits, then sees the status the first one left behind.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CorrespondenceRequest r where r.id = :id")
    Optional<CorrespondenceRequest> findByIdForUpdate(@Param("id") Long id);

    /** Reference numbers starting with a prefix such as "CTS-2026-" (used to seed a year's counter). */
    @Query("select r.referenceNumber from CorrespondenceRequest r where r.referenceNumber like :prefix")
    List<String> findReferenceNumbersLike(@Param("prefix") String prefix);
}
