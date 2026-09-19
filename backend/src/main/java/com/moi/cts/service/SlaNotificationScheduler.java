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
 * Daily sweep that nudges assignees about at-risk requests -- the
 * scheduled job the original 20-day plan's SLA design called for. It
 * notifies rather than writing to a separate SLA-status table: SLA status
 * here is a live-computed property (CorrespondenceRequest.getSlaStatus())
 * that never needs a background job to stay correct. Only the "tell
 * someone about it" part actually benefits from running on a schedule
 * instead of on every page load, so that's the only part this job does.
 */
@Component
public class SlaNotificationScheduler {

    private final CorrespondenceRequestRepository requestRepository;
    private final NotificationRepository notificationRepository;

    public SlaNotificationScheduler(CorrespondenceRequestRepository requestRepository,
                                     NotificationRepository notificationRepository) {
        this.requestRepository = requestRepository;
        this.notificationRepository = notificationRepository;
    }

    @Scheduled(cron = "0 0 8 * * *")
    @Transactional
    public void notifyAssigneesOfAtRiskRequests() {
        Instant notifiedRecentlyCutoff = Instant.now().minus(20, ChronoUnit.HOURS);

        for (CorrespondenceRequest r : requestRepository.findAll()) {
            if (r.getAssignedTo() == null) continue;
            SlaStatus slaStatus = r.getSlaStatus();
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
