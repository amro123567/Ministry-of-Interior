package com.moi.cts.service;

import com.moi.cts.entity.Notification;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.NotificationRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    public List<Map<String, Object>> forUser(Long userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId).stream()
                .map(n -> Map.<String, Object>of(
                        "id", n.getId(),
                        "message", n.getMessage(),
                        "read", n.isReadFlag(),
                        "createdAt", n.getCreatedAt(),
                        "requestId", n.getRelatedRequest() != null ? n.getRelatedRequest().getId() : null))
                .toList();
    }

    /** Marks one of the caller's OWN notifications as read; anyone else's is reported as not found. */
    public void markRead(Long notificationId, Long actorId) {
        Notification n = notificationRepository.findById(notificationId)
                .filter(x -> x.getRecipient() != null && x.getRecipient().getId().equals(actorId))
                .orElseThrow(() -> new NotFoundException("Notification not found: " + notificationId));
        n.setReadFlag(true);
        notificationRepository.save(n);
    }
}
