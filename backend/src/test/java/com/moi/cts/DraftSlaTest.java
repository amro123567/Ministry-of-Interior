package com.moi.cts;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.RequestStatus;
import com.moi.cts.entity.SlaStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** A draft has not been submitted, so its SLA clock must not be running. */
class DraftSlaTest {

    private CorrespondenceRequest requestWith(RequestStatus status) {
        CorrespondenceRequest r = new CorrespondenceRequest();
        r.setStatus(status);
        r.setDueAt(Instant.now().minus(3, ChronoUnit.DAYS));
        return r;
    }

    @Test
    void draftPastItsDueDateIsNotOverdue() {
        CorrespondenceRequest draft = requestWith(RequestStatus.DRAFT);
        assertThat(draft.isOverdue()).isFalse();
        assertThat(draft.getSlaStatus()).isEqualTo(SlaStatus.ON_TRACK);
    }

    @Test
    void submittedRequestPastItsDueDateIsStillOverdue() {
        CorrespondenceRequest submitted = requestWith(RequestStatus.SUBMITTED);
        assertThat(submitted.isOverdue()).isTrue();
        assertThat(submitted.getSlaStatus()).isEqualTo(SlaStatus.OVERDUE);
    }
}
