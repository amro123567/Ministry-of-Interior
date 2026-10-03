package com.moi.cts.repository;

import com.moi.cts.entity.WorkflowState;
import com.moi.cts.entity.WorkflowTransition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WorkflowTransitionRepository extends JpaRepository<WorkflowTransition, Long> {
    List<WorkflowTransition> findByFromStateAndActiveTrue(WorkflowState fromState);
    Optional<WorkflowTransition> findByActionCode(String actionCode);
    boolean existsByFromStateAndToState(WorkflowState fromState, WorkflowState toState);

    /** The active transition between two states, looked up by state code (used by the request workflow). */
    @Query("select t from WorkflowTransition t where t.fromState.code = :from and t.toState.code = :to and t.active = true")
    Optional<WorkflowTransition> findActiveByStateCodes(@Param("from") String from, @Param("to") String to);

    /** All active transitions out of the state with this code, in the target states' display order. */
    @Query("select t from WorkflowTransition t where t.fromState.code = :from and t.active = true order by t.toState.displayOrder")
    List<WorkflowTransition> findActiveFromStateCode(@Param("from") String from);
}
