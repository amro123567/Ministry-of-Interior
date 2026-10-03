package com.moi.cts.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

/**
 * The full-requirements migration punch list's Item 7 ("session/login
 * hardening as its own domain -- dedicated tables, not just fields on
 * AppUser"): the ERD's {@code login_attempts} -- one row per login
 * attempt, successful or not, distinct from {@link AppUser}'s own
 * {@code failedLoginAttempts}/{@code lockedUntil} counters (added in the
 * earlier incremental-extension round), which only ever hold the
 * *current* streak, not a queryable history of who tried, from where,
 * and why it failed.
 *
 * <p>{@link #user} is nullable on purpose: a login attempt against a
 * username that doesn't exist in the system at all still gets a row
 * (with {@link LoginFailureReason#UNKNOWN_USER}) -- that's precisely the
 * pattern (credential-stuffing against usernames that were never valid)
 * a security review would want visible, and there's no user row to link
 * it to.
 */
@Immutable
@Entity
@Table(name = "login_attempts")
public class LoginAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username_attempted", nullable = false, length = 60)
    private String usernameAttempted;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(name = "was_successful", nullable = false)
    private boolean wasSuccessful;

    @Enumerated(EnumType.STRING)
    @Column(name = "failure_reason", length = 20)
    private LoginFailureReason failureReason;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    @Column(name = "attempted_at", nullable = false, updatable = false)
    private Instant attemptedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsernameAttempted() { return usernameAttempted; }
    public void setUsernameAttempted(String usernameAttempted) { this.usernameAttempted = usernameAttempted; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public boolean isWasSuccessful() { return wasSuccessful; }
    public void setWasSuccessful(boolean wasSuccessful) { this.wasSuccessful = wasSuccessful; }
    public LoginFailureReason getFailureReason() { return failureReason; }
    public void setFailureReason(LoginFailureReason failureReason) { this.failureReason = failureReason; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public Instant getAttemptedAt() { return attemptedAt; }
    public void setAttemptedAt(Instant attemptedAt) { this.attemptedAt = attemptedAt; }
}
