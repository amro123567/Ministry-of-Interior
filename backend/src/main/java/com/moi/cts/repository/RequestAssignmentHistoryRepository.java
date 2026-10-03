package com.moi.cts.repository;

import com.moi.cts.entity.RequestAssignmentHistory;

import java.util.List;

public interface RequestAssignmentHistoryRepository extends AppendOnlyRepository<RequestAssignmentHistory, Long> {
    List<RequestAssignmentHistory> findByRequestIdOrderByAssignedAtDesc(Long requestId);
}
