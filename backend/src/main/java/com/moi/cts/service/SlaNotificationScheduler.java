package com.moi.cts.service;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.Notification;
import com.moi.cts.entity.SlaStatus;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.repository.NotificationRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Daily sweep that (1) records when a request first breaches its SLA and
 * (2) nudges assignees about at-risk requests -- the scheduled job the
 * original 20-day plan's SLA design called for. It notifies (and now,
 * records a breach timestamp) rather than writing a full SLA-status table:
 * SLA status itself is a live-computed property
 * (CorrespondenceRequest.getSlaStatus()) that never needs a background job
 * to stay correct. The two things that genuinely benefit from running on a
 * schedule instead of on every page load are "tell someone about it" and
 * "remember the moment this first became true" -- so that's all this job
 * does. Caveat, stated plainly: because this runs once a day, breachedAt
 * can lag the real breach moment by up to ~24 hours -- a request that goes
 * overdue at 9am is recorded at the next 8am run, not the moment it happens.
 *
 * <p>As of the full-requirements migration punch list's Item 5, this same
 * daily run also refreshes every request's persisted {@code SlaRecord}
 * snapshot (see {@code RequestFinanceService}/{@code SlaRecord} for why
 * that table exists alongside this still-unchanged live-computation
 * design) -- one extra call, no change to the notification logic above.
 */
@Component
public class SlaNotificationScheduler {

    private final CorrespondenceRequestRepository requestRepository;
    private final NotificationRepository notificationRepository;
    private final RequestFinanceService requestFinanceService;

    public SlaNotificationScheduler(CorrespondenceRequestRepository requestRepository,
                                     NotificationRepository notificationRepository,
                                     RequestFinanceService requestFinanceService) {
        this.requestRepository = requestRepository;
        this.notificationRepository = notificationRepository;
        this.requestFinanceService = requestFinanceService;
    }

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void notifyAssigneesOfAtRiskRequests() {
        requestFinanceService.refreshAll();
        Instant notifiedRecentlyCutoff = Instant.now().minus(20, ChronoUnit.HOURS);

        for (CorrespondenceRequest r : requestRepository.findAll()) {
            SlaStatus slaStatus = r.getSlaStatus();

            if (slaStatus == SlaStatus.OVERDUE && r.getBreachedAt() == null) {
                r.setBreachedAt(Instant.now());
                requestRepository.save(r);
            }

            if (r.getAssignedTo() == null) continue;
            if (slaStatus == SlaStatus.ON_TRACK) continue;

            boolean alreadyNotifiedToday = notificationRepository
                    .findByRecipientIdOrderByCreatedAtDesc(r.getAssignedTo().getId()).stream()
                    .anyMatch(n -> n.getRelatedRequest() != null
                            && n.getRelatedRequest().getId().equals(r.getId())
                            && n.getCreatedAt().isAfter(notifiedRecentlyCutoff)
                            && n.getMessage().contains(slaStatus.name()));
            if (alreadyNotifiedToday) continue;

            Notification n = new Notification();
            n.setRecipient(r.getAssignedTo());
            n.setRelatedRequest(r);
            n.setMessage("Request " + r.getReferenceNumber() + " is " + slaStatus.name().replace('_', ' ')
                    + " (due " + r.getDueAt() + ").");
            notificationRepository.save(n);
        }
    }
}
