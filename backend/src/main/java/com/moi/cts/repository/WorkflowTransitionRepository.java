package com.moi.cts.repository;

import com.moi.cts.entity.WorkflowState;
import com.moi.cts.entity.WorkflowTransition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkflowTransitionRepository extends JpaRepository<WorkflowTransition, Long> {
    List<WorkflowTransition> findByFromStateAndActiveTrue(WorkflowState fromState);
    Optional<WorkflowTransition> findByActionCode(String actionCode);
    boolean existsByFromStateAndToState(WorkflowState fromState, WorkflowState toState);
}
