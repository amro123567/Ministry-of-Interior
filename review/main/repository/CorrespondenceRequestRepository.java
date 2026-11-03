package com.moi.cts.repository;

import com.moi.cts.entity.CorrespondenceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CorrespondenceRequestRepository
        extends JpaRepository<CorrespondenceRequest, Long>, JpaSpecificationExecutor<CorrespondenceRequest> {

    /** Reference numbers starting with a prefix such as "CTS-2026-" (used to seed a year's counter). */
    @Query("select r.referenceNumber from CorrespondenceRequest r where r.referenceNumber like :prefix")
    List<String> findReferenceNumbersLike(@Param("prefix") String prefix);
}
