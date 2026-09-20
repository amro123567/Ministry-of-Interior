package com.moi.cts.repository;

import com.moi.cts.entity.WorkflowState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkflowStateRepository extends JpaRepository<WorkflowState, Long> {
    Optional<WorkflowState> findByCode(String code);
    List<WorkflowState> findByInitialTrueAndActiveTrue();
    List<WorkflowState> findByActiveTrueOrderByDisplayOrderAsc();
}
