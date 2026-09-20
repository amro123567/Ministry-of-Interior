package com.moi.cts.controller;

import com.moi.cts.dto.SessionSecurityDtos.LoginAttemptDto;
import com.moi.cts.dto.SessionSecurityDtos.SessionLogDto;
import com.moi.cts.service.SessionSecurityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read endpoints for Item 7's two new tables. Nested under
 * {@code /api/audit/**} for the same reason Item 6's citizen-audit
 * endpoints were: that path is already gated by
 * {@code hasAuthority("AUDIT_VIEW")} in {@code SecurityConfig}, and login/
 * session history is exactly the kind of security-administrator-only
 * data that gate already exists to protect -- no SecurityConfig change
 * needed.
 */
@RestController
public class SessionSecurityController {

    private final SessionSecurityService sessionSecurityService;

    public SessionSecurityController(SessionSecurityService sessionSecurityService) {
        this.sessionSecurityService = sessionSecurityService;
    }

    @GetMapping("/api/audit/login-attempts")
    public List<LoginAttemptDto> loginAttempts(@RequestParam(required = false) String username) {
        return username == null ? sessionSecurityService.recentAttempts()
                : sessionSecurityService.attemptsForUsername(username);
    }

    @GetMapping("/api/audit/sessions/user/{userId}")
    public List<SessionLogDto> sessionsForUser(@PathVariable Long userId) {
        return sessionSecurityService.sessionsForUser(userId);
    }
}
