package com.moi.cts.service;

import com.moi.cts.dto.AuthDtos.*;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.DenylistedToken;
import com.moi.cts.entity.LoginFailureReason;
import com.moi.cts.entity.RefreshToken;
import com.moi.cts.exception.ApiExceptions.AuthException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.DenylistedTokenRepository;
import com.moi.cts.repository.RefreshTokenRepository;
import com.moi.cts.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final AppUserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final DenylistedTokenRepository denylistedTokenRepository;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final SessionSecurityService sessionSecurityService;
    private final int maxLoginAttempts;
    private final long lockoutMinutes;

    public AuthService(AuthenticationManager authenticationManager, AppUserRepository userRepository,
                        RefreshTokenRepository refreshTokenRepository,
                        DenylistedTokenRepository denylistedTokenRepository, JwtService jwtService,
                        AuditService auditService, SessionSecurityService sessionSecurityService,
                        @Value("${cts.security.max-login-attempts}") int maxLoginAttempts,
                        @Value("${cts.security.lockout-minutes}") long lockoutMinutes) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.denylistedTokenRepository = denylistedTokenRepository;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.sessionSecurityService = sessionSecurityService;
        this.maxLoginAttempts = maxLoginAttempts;
        this.lockoutMinutes = lockoutMinutes;
    }

    @Transactional
    public TokenResponse login(LoginRequest request) {
        AppUser lookedUp = userRepository.findByUsername(request.username()).orElse(null);
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (LockedException e) {
            sessionSecurityService.recordLoginAttempt(request.username(), lookedUp, false,
                    LoginFailureReason.ACCOUNT_LOCKED);
            throw new AuthException("This account is locked due to too many failed login attempts. Try again later.");
        } catch (DisabledException e) {
            // Item 7 fix: AppUserPrincipal.isEnabled() reflects AppUser's
            // own isEnabled(), so DaoAuthenticationProvider's own
            // pre-authentication check already throws this for a disabled
            // account -- it was never actually reaching the manual
            // "!user.isEnabled()" check a few lines below, which meant a
            // disabled account's login attempt was falling through
            // uncaught to the generic 500 handler instead of the intended
            // "This account is disabled." message. No test exercised this
            // path before, so this is a strict fix, not a behavior change
            // anything depended on -- found while wiring in login_attempts,
            // which needed to classify this branch correctly anyway.
            sessionSecurityService.recordLoginAttempt(request.username(), lookedUp, false,
                    LoginFailureReason.ACCOUNT_INACTIVE);
            throw new AuthException("This account is disabled.");
        } catch (BadCredentialsException e) {
            recordFailedAttempt(request.username());
            sessionSecurityService.recordLoginAttempt(request.username(), lookedUp, false,
                    lookedUp == null ? LoginFailureReason.UNKNOWN_USER : LoginFailureReason.BAD_PASSWORD);
            throw new AuthException("Invalid username or password.");
        }
        AppUser user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new AuthException("Invalid username or password."));
        if (!user.isEnabled()) {
            // Defensive fallback only, kept in case the pre-authentication
            // check above is ever bypassed -- see the DisabledException
            // catch's comment for why this branch shouldn't normally be
            // reachable any more.
            sessionSecurityService.recordLoginAttempt(request.username(), user, false,
                    LoginFailureReason.ACCOUNT_INACTIVE);
            throw new AuthException("This account is disabled.");
        }
        resetFailedAttempts(user);

        List<String> roles = user.getRoles().stream().map(r -> r.getName().name()).toList();
        String access = jwtService.generateAccessToken(user.getUsername(), roles);
        String refreshValue = issueRefreshToken(user);

        sessionSecurityService.recordLoginAttempt(request.username(), user, true, null);
        sessionSecurityService.openSession(user, jwtService.extractJti(access), jwtService.extractExpiration(access));

        auditService.log("AppUser", user.getId(), "LOGIN", user, null);
        return new TokenResponse(access, refreshValue, user.getUsername(), user.getFullName(),
                roles, effectivePermissions(user));
    }

    /**
     * The union of every permission granted by any role this user holds --
     * sent to the frontend alongside {@code roles} so it can gate UI on the
     * same permission model the backend actually enforces (SecurityConfig,
     * RequestService.transition()), instead of the frontend hardcoding its
     * own idea of which role name means what.
     */
    private List<String> effectivePermissions(AppUser user) {
        return user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(com.moi.cts.entity.Permission::getCode)
                .distinct()
                .sorted()
                .toList();
    }

    /**
     * Bumps the failed-attempt counter and locks the account once it
     * crosses maxLoginAttempts. Looked up by username rather than passed a
     * principal, since a bad password never resolves to an authenticated
     * user -- and if the username itself doesn't exist, there's nothing to
     * lock, so this silently no-ops (matching the generic "invalid username
     * or password" message, which deliberately doesn't reveal which part
     * was wrong).
     */
    private void recordFailedAttempt(String username) {
        userRepository.findByUsername(username).ifPresent(u -> {
            int attempts = u.getFailedLoginAttempts() + 1;
            u.setFailedLoginAttempts(attempts);
            if (attempts >= maxLoginAttempts) {
                u.setLockedUntil(Instant.now().plus(lockoutMinutes, ChronoUnit.MINUTES));
            }
            userRepository.save(u);
            auditService.log("AppUser", u.getId(), "LOGIN_FAILED", u, "attempt " + attempts + " of " + maxLoginAttempts);
        });
    }

    private void resetFailedAttempts(AppUser user) {
        if (user.getFailedLoginAttempts() != 0 || user.getLockedUntil() != null) {
            user.setFailedLoginAttempts(0);
            user.setLockedUntil(null);
            userRepository.save(user);
        }
    }

    @Transactional
    public TokenResponse refresh(String refreshTokenValue) {
        String hash = jwtService.hash(refreshTokenValue);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new AuthException("Refresh token is not recognized."));
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            if (stored.isRevoked()) {
                // A revoked refresh token being presented again is the
                // classic signature of token theft/replay -- the
                // legitimate client would already hold the rotated
                // replacement issued below, not still be holding this one.
                // Everyday expiry (the other half of this condition) isn't
                // logged: that's just a session timing out, not an anomaly.
                auditService.log("AppUser", stored.getUser().getId(), "REFRESH_TOKEN_REUSE_DETECTED",
                        stored.getUser(), null);
            }
            throw new AuthException("Refresh token has expired or was revoked. Please log in again.");
        }
        AppUser user = stored.getUser();
        if (!user.isEnabled()) {
            throw new AuthException("This account is disabled.");
        }
        List<String> roles = user.getRoles().stream().map(r -> r.getName().name()).toList();
        String access = jwtService.generateAccessToken(user.getUsername(), roles);

        // rotate: revoke the old refresh token, issue a new one
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        String newRefresh = issueRefreshToken(user);

        return new TokenResponse(access, newRefresh, user.getUsername(), user.getFullName(),
                roles, effectivePermissions(user));
    }

    @Transactional
    public void logout(String refreshTokenValue, String accessToken) {
        if (refreshTokenValue != null && !refreshTokenValue.isBlank()) {
            refreshTokenRepository.findByTokenHash(jwtService.hash(refreshTokenValue))
                    .ifPresent(t -> {
                        t.setRevoked(true);
                        refreshTokenRepository.save(t);
                        // Previously the only auth action that wasn't audited --
                        // login logs itself above, logout didn't. The token
                        // already carries who it belongs to, so this is a
                        // three-line addition rather than a reason to route
                        // logout through the AOP aspect.
                        auditService.log("AppUser", t.getUser().getId(), "LOGOUT", t.getUser(), null);
                    });
        }
        denylistAccessToken(accessToken);
    }

    /**
     * Revoking the refresh token alone leaves the access token that was
     * already issued (up to cts.jwt.access-token-minutes) still valid --
     * JwtAuthFilter only checks the signature and expiry, not whether the
     * user has since logged out. Recording its jti here closes that gap:
     * JwtAuthFilter rejects any token whose jti shows up in this table,
     * regardless of its remaining signed lifetime. Best-effort: a missing,
     * already-expired, or malformed access token just means there's
     * nothing useful to denylist, not a reason to fail the whole logout.
     */
    private void denylistAccessToken(String accessToken) {
        if (accessToken == null || accessToken.isBlank()) return;
        try {
            String jti = jwtService.extractJti(accessToken);
            if (jti == null) return;
            // Item 7: close this session's SessionLog row (if one is open)
            // regardless of whether it's already denylisted -- a second
            // logout call with the same access token is harmless either
            // way, but shouldn't be skipped just because the token was.
            sessionSecurityService.closeSession(jti);
            if (denylistedTokenRepository.existsByJti(jti)) return;
            String username = jwtService.extractUsername(accessToken);
            DenylistedToken denylisted = new DenylistedToken();
            denylisted.setJti(jti);
            denylisted.setTokenExpiresAt(jwtService.extractExpiration(accessToken));
            denylisted.setReason("LOGOUT");
            userRepository.findByUsername(username).ifPresent(denylisted::setUser);
            denylistedTokenRepository.save(denylisted);
        } catch (Exception ignored) {
            // Token already expired/malformed -- nothing to revoke.
        }
    }

    private String issueRefreshToken(AppUser user) {
        String value = jwtService.generateRefreshTokenValue();
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(jwtService.hash(value));
        token.setExpiresAt(Instant.now().plus(jwtService.refreshTokenDays(), ChronoUnit.DAYS));
        refreshTokenRepository.save(token);
        return value;
    }
}
