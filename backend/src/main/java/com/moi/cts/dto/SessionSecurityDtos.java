package com.moi.cts.dto;

import java.time.Instant;

/** DTOs for Item 7's two new tables: {@link com.moi.cts.entity.LoginAttempt} and {@link com.moi.cts.entity.SessionLog}. */
public class SessionSecurityDtos {

    public record LoginAttemptDto(Long id, String usernameAttempted, Long userId, boolean wasSuccessful,
                                   String failureReason, String ipAddress, String userAgent, Instant attemptedAt) {}

    public record SessionLogDto(Long id, Long userId, String username, String jti, Instant loginAt,
                                 Instant logoutAt, Instant expiresAt, String ipAddress, String userAgent) {}
}
