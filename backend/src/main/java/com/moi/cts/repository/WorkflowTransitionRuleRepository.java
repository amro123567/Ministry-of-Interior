package com.moi.cts.repository;

import com.moi.cts.entity.RequestStatus;
import com.moi.cts.entity.WorkflowTransitionRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface WorkflowTransitionRuleRepository extends JpaRepository<WorkflowTransitionRule, Long> {
    Optional<WorkflowTransitionRule> findByFromStatusAndToStatus(RequestStatus from, RequestStatus to);
}
