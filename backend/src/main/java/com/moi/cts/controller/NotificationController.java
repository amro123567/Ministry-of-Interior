package com.moi.cts.controller;

import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<Map<String, Object>> mine(@AuthenticationPrincipal AppUserPrincipal actor) {
        return notificationService.forUser(actor.getId());
    }

    @PatchMapping("/{id}/read")
    public void markRead(@PathVariable Long id) { notificationService.markRead(id); }
}
