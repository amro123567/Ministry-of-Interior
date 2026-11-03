package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Item 7's second new table: the ERD's {@code session_logs} -- one row
 * per issued access token, keyed by the same {@code jti} claim the token
 * itself carries (see {@code JwtService.generateAccessToken}) and
 * already reused, load-bearing, by {@link DenylistedToken}. Distinct
 * from {@link RefreshToken}: that table exists purely to make refresh
 * rotation and logout-revocation *work*, and was never meant to answer
 * "who was logged in, from where, for how long" -- this table is.
 *
 * <p>Opened by {@code AuthService.login()} right after a successful
 * authentication (immediately after the access token is generated, so
 * its own {@code jti}/expiry can be read straight back off it rather
 * than recomputed) and closed by {@code AuthService.logout()} at the
 * same point the access token's {@code jti} is extracted to denylist it
 * -- one row, two writes, no duplicated jti-extraction logic.
 */
@Entity
@Table(name = "session_logs")
public class SessionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private AppUser user;

    @Column(nullable = false, unique = true, length = 36)
    private String jti;

    @Column(name = "login_at", nullable = false, updatable = false)
    private Instant loginAt = Instant.now();

    @Column(name = "logout_at")
    private Instant logoutAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", length = 255)
    private String userAgent;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public String getJti() { return jti; }
    public void setJti(String jti) { this.jti = jti; }
    public Instant getLoginAt() { return loginAt; }
    public void setLoginAt(Instant loginAt) { this.loginAt = loginAt; }
    public Instant getLogoutAt() { return logoutAt; }
    public void setLogoutAt(Instant logoutAt) { this.logoutAt = logoutAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
}
