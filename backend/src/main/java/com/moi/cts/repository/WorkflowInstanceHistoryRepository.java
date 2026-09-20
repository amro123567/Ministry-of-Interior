package com.moi.cts.repository;

import com.moi.cts.entity.WorkflowInstance;
import com.moi.cts.entity.WorkflowInstanceHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WorkflowInstanceHistoryRepository extends JpaRepository<WorkflowInstanceHistory, Long> {
    List<WorkflowInstanceHistory> findByInstanceOrderByOccurredAtAsc(WorkflowInstance instance);
}
