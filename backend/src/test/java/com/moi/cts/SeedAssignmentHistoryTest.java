package com.moi.cts;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.repository.RequestAssignmentHistoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

/** Every seeded request that has an assignee also has an assignment-history row for that assignee. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SeedAssignmentHistoryTest {

    @Autowired CorrespondenceRequestRepository requestRepository;
    @Autowired RequestAssignmentHistoryRepository assignmentHistoryRepository;

    @Test
    void seededAssigneesHaveAnAssignmentHistoryRow() {
        int checked = 0;
        for (CorrespondenceRequest r : requestRepository.findAll()) {
            if (r.getAssignedTo() == null) continue;
            checked++;
            var history = assignmentHistoryRepository.findByRequestIdOrderByAssignedAtDesc(r.getId());
            assertThat(history)
                    .as("assignment history of %s", r.getReferenceNumber())
                    .isNotEmpty();
            assertThat(history.get(0).getAssignedTo().getId()).isEqualTo(r.getAssignedTo().getId());
        }
        assertThat(checked).isGreaterThanOrEqualTo(2); // the two seeded requests with an assignee
    }
}
