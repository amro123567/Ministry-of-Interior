package com.moi.cts.repository;

import com.moi.cts.entity.WorkflowInstance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstance, Long> {
    Optional<WorkflowInstance> findByEntityTypeAndEntityId(String entityType, Long entityId);
}
