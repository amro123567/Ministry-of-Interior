package com.moi.cts;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.service.AuditService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/** Seeded requests show an Activity log from the start: a CREATE entry, plus ASSIGN when they have an assignee. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SeedAuditLogTest {

    @Autowired CorrespondenceRequestRepository requestRepository;
    @Autowired AuditService auditService;

    @Test
    void everyRequestHasACreateEntryAndAssignedOnesHaveAnAssignEntry() {
        var requests = requestRepository.findAll();
        assertThat(requests).hasSizeGreaterThanOrEqualTo(4);
        for (CorrespondenceRequest r : requests) {
            var actions = auditService.forEntity("CorrespondenceRequest", r.getId())
                    .stream().map(e -> e.action()).toList();
            assertThat(actions).as("audit actions of %s", r.getReferenceNumber()).contains("CREATE");
            if (r.getAssignedTo() != null) {
                assertThat(actions).as("audit actions of %s", r.getReferenceNumber()).contains("ASSIGN");
            }
        }
    }
}
