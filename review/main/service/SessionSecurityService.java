package com.moi.cts.service;

import com.moi.cts.dto.SessionSecurityDtos.LoginAttemptDto;
import com.moi.cts.dto.SessionSecurityDtos.SessionLogDto;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.LoginAttempt;
import com.moi.cts.entity.LoginFailureReason;
import com.moi.cts.entity.SessionLog;
import com.moi.cts.repository.LoginAttemptRepository;
import com.moi.cts.repository.SessionLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.List;

/**
 * Item 7 ("session/login hardening as its own domain"): writes for the
 * two new tables, {@link LoginAttempt} and {@link SessionLog}. Kept
 * separate from {@code AuthService} itself (which calls this rather than
 * writing directly) the same way every other item this migration split
 * its new persistence concern into its own service -- {@code AuthService}
 * already does a lot (authentication, refresh rotation, the existing
 * lockout counters, the token denylist); this keeps the two genuinely
 * new tables' read/write logic in one place instead of growing that
 * class further.
 */
@Service
public class SessionSecurityService {

    private final LoginAttemptRepository loginAttemptRepository;
    private final SessionLogRepository sessionLogRepository;

    public SessionSecurityService(LoginAttemptRepository loginAttemptRepository,
                                   SessionLogRepository sessionLogRepository) {
        this.loginAttemptRepository = loginAttemptRepository;
        this.sessionLogRepository = sessionLogRepository;
    }

    // ==== login_attempts =====================================================

    @Transactional
    public void recordLoginAttempt(String usernameAttempted, AppUser user, boolean wasSuccessful,
                                    LoginFailureReason failureReason) {
        LoginAttempt attempt = new LoginAttempt();
        attempt.setUsernameAttempted(usernameAttempted);
        attempt.setUser(user);
        attempt.setWasSuccessful(wasSuccessful);
        attempt.setFailureReason(failureReason);
        attempt.setIpAddress(currentIpAddress());
        attempt.setUserAgent(currentUserAgent());
        loginAttemptRepository.save(attempt);
    }

    public List<LoginAttemptDto> recentAttempts() {
        return loginAttemptRepository.findTop50ByOrderByAttemptedAtDescIdDesc().stream().map(this::toDto).toList();
    }

    public List<LoginAttemptDto> attemptsForUsername(String username) {
        return loginAttemptRepository.findByUsernameAttemptedOrderByAttemptedAtDescIdDesc(username).stream()
                .map(this::toDto).toList();
    }

    // ==== session_logs ========================================================

    @Transactional
    public void openSession(AppUser user, String jti, Instant expiresAt) {
        if (jti == null) return; // nothing to key the row on -- shouldn't happen, but never worth failing login over
        SessionLog log = new SessionLog();
        log.setUser(user);
        log.setJti(jti);
        log.setExpiresAt(expiresAt);
        log.setIpAddress(currentIpAddress());
        log.setUserAgent(currentUserAgent());
        sessionLogRepository.save(log);
    }

    /** Best-effort: a jti with no matching open session (already closed, or the access token was never logged) is a no-op. */
    @Transactional
    public void closeSession(String jti) {
        if (jti == null) return;
        sessionLogRepository.findByJti(jti).ifPresent(log -> {
            if (log.getLogoutAt() == null) {
                log.setLogoutAt(Instant.now());
                sessionLogRepository.save(log);
            }
        });
    }

    public List<SessionLogDto> sessionsForUser(Long userId) {
        return sessionLogRepository.findByUserIdOrderByLoginAtDesc(userId).stream().map(this::toDto).toList();
    }

    // ==== helpers ============================================================

    /** Same technique as CitizenAuditService: the write always happens on the thread still handling the HTTP request. */
    private String currentIpAddress() {
        ServletRequestAttributes attrs = currentRequest();
        return attrs == null ? null : attrs.getRequest().getRemoteAddr();
    }

    private String currentUserAgent() {
        ServletRequestAttributes attrs = currentRequest();
        return attrs == null ? null : attrs.getRequest().getHeader("User-Agent");
    }

    private ServletRequestAttributes currentRequest() {
        try {
            return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes s ? s : null;
        } catch (IllegalStateException e) {
            return null;
        }
    }

    private LoginAttemptDto toDto(LoginAttempt a) {
        return new LoginAttemptDto(a.getId(), a.getUsernameAttempted(), a.getUser() != null ? a.getUser().getId() : null,
                a.isWasSuccessful(), a.getFailureReason() != null ? a.getFailureReason().name() : null,
                a.getIpAddress(), a.getUserAgent(), a.getAttemptedAt());
    }

    private SessionLogDto toDto(SessionLog s) {
        return new SessionLogDto(s.getId(), s.getUser().getId(), s.getUser().getUsername(), s.getJti(),
                s.getLoginAt(), s.getLogoutAt(), s.getExpiresAt(), s.getIpAddress(), s.getUserAgent());
    }
}
