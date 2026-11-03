package com.moi.cts.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTokenMinutes;
    private final long refreshTokenDays;

    public JwtService(@Value("${cts.jwt.secret}") String secret,
                       @Value("${cts.jwt.access-token-minutes}") long accessTokenMinutes,
                       @Value("${cts.jwt.refresh-token-days}") long refreshTokenDays) {
        // Refuse to start with a secret anyone could guess: tokens signed with it could be forged.
        byte[] raw = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        String lowered = secret == null ? "" : secret.toLowerCase(java.util.Locale.ROOT);
        if (raw.length < 32 || lowered.contains("change-this") || lowered.contains("generate-a-long-random")) {
            throw new IllegalStateException("JWT_SECRET is missing, too short (need 32+ characters) or still a "
                    + "placeholder. Set it to a long random value, e.g. in PowerShell: "
                    + "[Convert]::ToBase64String((1..48|%{Get-Random -Max 256}))");
        }
        this.key = Keys.hmacShaKeyFor(raw);
        this.accessTokenMinutes = accessTokenMinutes;
        this.refreshTokenDays = refreshTokenDays;
    }

    public String generateAccessToken(String username, List<String> roles) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(username)
                .claim("roles", roles)
                .claim("type", "access")
                .id(UUID.randomUUID().toString())
                .issuedAt(java.util.Date.from(now))
                .expiration(java.util.Date.from(now.plus(accessTokenMinutes, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    /** Opaque refresh token; only its SHA-256 hash is persisted (see RefreshTokenRepository). */
    public String generateRefreshTokenValue() {
        return UUID.randomUUID() + "." + UUID.randomUUID();
    }

    public String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public long refreshTokenDays() {
        return refreshTokenDays;
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /** The unique "jti" claim every access token carries (see generateAccessToken). */
    public String extractJti(String token) {
        return extractClaim(token, Claims::getId);
    }

    public Instant extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration).toInstant();
    }

    @SuppressWarnings("unchecked")
    public List<String> extractRoles(String token) {
        return extractClaim(token, c -> (List<String>) c.get("roles"));
    }

    public boolean isTokenValid(String token, String username) {
        return extractUsername(token).equals(username) && !isExpired(token);
    }

    private boolean isExpired(String token) {
        return extractClaim(token, Claims::getExpiration).before(new java.util.Date());
    }

    private <T> T extractClaim(String token, Function<Claims, T> resolver) {
        Claims claims = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
        return resolver.apply(claims);
    }
}
