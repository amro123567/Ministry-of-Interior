package com.moi.cts.config;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.RequestStateHistory;
import com.moi.cts.entity.RequestStatus;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.repository.RequestStateHistoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Until now, archiving a request overwrote its close time with the archive time. That made
 * on-time decisions look late (SLA record BREACHED, inflated resolution time). The code no
 * longer does that; this one-off, idempotent repair puts the close time of already-archived
 * requests back to the moment they were approved or rejected, taken from their status history.
 * It only ever moves a close time EARLIER, and does nothing once every request is consistent.
 */
@Component
public class RequestClosedAtRepair implements CommandLineRunner {

    private static final Logger LOG = LoggerFactory.getLogger(RequestClosedAtRepair.class);

    private final CorrespondenceRequestRepository requestRepository;
    private final RequestStateHistoryRepository historyRepository;

    public RequestClosedAtRepair(CorrespondenceRequestRepository requestRepository,
                                 RequestStateHistoryRepository historyRepository) {
        this.requestRepository = requestRepository;
        this.historyRepository = historyRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        int repaired = 0;
        for (CorrespondenceRequest r : requestRepository.findAll()) {
            if (r.getStatus() != RequestStatus.ARCHIVED || r.getClosedAt() == null) continue;
            Instant decidedAt = historyRepository.findByRequestIdOrderByChangedAtAsc(r.getId()).stream()
                    .filter(h -> h.getToStatus() == RequestStatus.APPROVED || h.getToStatus() == RequestStatus.REJECTED)
                    .map(RequestStateHistory::getChangedAt)
                    .reduce((earlier, later) -> later)
                    .orElse(null);
            if (decidedAt != null && r.getClosedAt().isAfter(decidedAt)) {
                r.setClosedAt(decidedAt);
                requestRepository.save(r);
                repaired++;
            }
        }
        if (repaired > 0) {
            LOG.info("Restored the close time of {} archived request(s) to the moment they were decided.", repaired);
        }
    }
}
