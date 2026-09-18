package com.moi.cts.repository;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.RequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CorrespondenceRequestRepository
        extends JpaRepository<CorrespondenceRequest, Long>, JpaSpecificationExecutor<CorrespondenceRequest> {

    long countByStatus(RequestStatus status);
}
