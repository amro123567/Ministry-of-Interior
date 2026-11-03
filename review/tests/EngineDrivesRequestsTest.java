package com.moi.cts;

import com.moi.cts.dto.RequestDtos.TransitionRequest;
import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.RequestStatus;
import com.moi.cts.entity.WorkflowTransition;
import com.moi.cts.exception.ApiExceptions.IllegalTransitionException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.repository.WorkflowTransitionRepository;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.RequestService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The workflow catalog (not hard-coded rules) decides what a request may do.
 * Every test changes the catalog inside a transaction that is rolled back, so the
 * shared test database is left untouched.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class EngineDrivesRequestsTest {

    @Autowired RequestService requestService;
    @Autowired CorrespondenceRequestRepository requestRepository;
    @Autowired WorkflowTransitionRepository workflowTransitionRepository;
    @Autowired AppUserRepository userRepository;

    private AppUserPrincipal principal(String username) {
        return new AppUserPrincipal(userRepository.findByUsername(username).orElseThrow());
    }

    private CorrespondenceRequest aDraftRequest() {
        CorrespondenceRequest req = requestRepository.findAll().get(0);
        req.setStatus(RequestStatus.DRAFT);
        return requestRepository.save(req);
    }

    @Test
    void deactivatingATransitionInTheCatalogMakesTheMoveIllegal() {
        CorrespondenceRequest req = aDraftRequest();
        AppUserPrincipal officer = principal("officer");
        assertThat(requestService.availableTransitions(req.getId(), officer))
                .extracting(t -> t.toStatus()).containsExactly("SUBMITTED");

        WorkflowTransition submit = workflowTransitionRepository.findByActionCode("SUBMIT").orElseThrow();
        submit.setActive(false);
        workflowTransitionRepository.save(submit);

        assertThat(requestService.availableTransitions(req.getId(), officer)).isEmpty();
        assertThatThrownBy(() -> requestService.transition(req.getId(),
                new TransitionRequest("SUBMITTED", null, null), officer))
                .isInstanceOf(IllegalTransitionException.class);
    }

    @Test
    void changingTheRequiredPermissionInTheCatalogChangesWhoMayDoTheMove() {
        CorrespondenceRequest req = aDraftRequest();
        AppUserPrincipal officer = principal("officer");
        WorkflowTransition submit = workflowTransitionRepository.findByActionCode("SUBMIT").orElseThrow();
        WorkflowTransition approve = workflowTransitionRepository.findByActionCode("APPROVE").orElseThrow();

        // Require the DECIDE permission (which the officer does not hold) to submit.
        submit.setRequiredPermissions(new HashSet<>(approve.getRequiredPermissions()));
        workflowTransitionRepository.save(submit);

        assertThat(requestService.availableTransitions(req.getId(), officer)).isEmpty();
        assertThatThrownBy(() -> requestService.transition(req.getId(),
                new TransitionRequest("SUBMITTED", null, null), officer))
                .isInstanceOf(IllegalTransitionException.class)
                .hasMessageContaining("REQUEST_TRANSITION_DECIDE");

        // The admin holds every permission, so the same move is still open to them.
        List<String> adminOptions = requestService.availableTransitions(req.getId(), principal("admin"))
                .stream().map(t -> t.toStatus()).toList();
        assertThat(adminOptions).containsExactly("SUBMITTED");
    }
}
