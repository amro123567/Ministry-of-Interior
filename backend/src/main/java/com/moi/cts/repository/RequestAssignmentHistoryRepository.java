package com.moi.cts.repository;

import com.moi.cts.entity.RequestAssignmentHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RequestAssignmentHistoryRepository extends JpaRepository<RequestAssignmentHistory, Long> {
    List<RequestAssignmentHistory> findByRequestIdOrderByAssignedAtDesc(Long requestId);
}
