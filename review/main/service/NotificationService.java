package com.moi.cts.service;

import com.moi.cts.entity.Notification;
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

    public void markRead(Long notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setReadFlag(true);
            notificationRepository.save(n);
        });
    }
}
