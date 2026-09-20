package com.moi.cts.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Access tokens are short-lived (30 min, see cts.jwt.access-token-minutes)
 * stateless JWTs, validated purely by signature + expiry in JwtAuthFilter --
 * logging out previously only revoked the *refresh* token, leaving an
 * already-issued access token valid until its natural expiry. This table
 * closes that gap: it's the load-bearing version of the ERD's
 * token_denylist table. Each JWT already carries a unique "jti" claim
 * (JwtService.generateAccessToken); logout records that jti here, and
 * JwtAuthFilter rejects any token whose jti is denylisted, regardless of
 * whether it's still within its signed expiry window.
 */
@Entity
@Table(name = "token_denylist")
public class DenylistedToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String jti;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser user;

    /**
     * The token's own expiry. Not enforced anywhere yet -- there is no
     * cleanup job -- but recording it is what would let a future scheduled
     * job safely prune rows whose underlying token has expired anyway
     * (a denylist entry for an already-expired token is redundant, since
     * JwtService.isTokenValid() rejects expired tokens on its own).
     */
    @Column(nullable = false)
    private Instant tokenExpiresAt;

    @Column(nullable = false, updatable = false)
    private Instant revokedAt = Instant.now();

    @Column(length = 30)
    private String reason;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getJti() { return jti; }
    public void setJti(String jti) { this.jti = jti; }
    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public Instant getTokenExpiresAt() { return tokenExpiresAt; }
    public void setTokenExpiresAt(Instant tokenExpiresAt) { this.tokenExpiresAt = tokenExpiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
