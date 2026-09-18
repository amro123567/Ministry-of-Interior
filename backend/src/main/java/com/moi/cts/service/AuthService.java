package com.moi.cts.service;

import com.moi.cts.dto.AuthDtos.*;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.RefreshToken;
import com.moi.cts.exception.ApiExceptions.AuthException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.RefreshTokenRepository;
import com.moi.cts.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
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
    private final JwtService jwtService;
    private final AuditService auditService;

    public AuthService(AuthenticationManager authenticationManager, AppUserRepository userRepository,
                        RefreshTokenRepository refreshTokenRepository, JwtService jwtService,
                        AuditService auditService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.auditService = auditService;
    }

    @Transactional
    public TokenResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (BadCredentialsException e) {
            throw new AuthException("Invalid username or password.");
        }
        AppUser user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new AuthException("Invalid username or password."));
        if (!user.isEnabled()) {
            throw new AuthException("This account is disabled.");
        }

        List<String> roles = user.getRoles().stream().map(r -> r.getName().name()).toList();
        String access = jwtService.generateAccessToken(user.getUsername(), roles);
        String refreshValue = issueRefreshToken(user);

        auditService.log("AppUser", user.getId(), "LOGIN", user, null);
        return new TokenResponse(access, refreshValue, user.getUsername(), user.getFullName(), roles);
    }

    @Transactional
    public TokenResponse refresh(String refreshTokenValue) {
        String hash = jwtService.hash(refreshTokenValue);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new AuthException("Refresh token is not recognized."));
        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            throw new AuthException("Refresh token has expired or was revoked. Please log in again.");
        }
        AppUser user = stored.getUser();
        List<String> roles = user.getRoles().stream().map(r -> r.getName().name()).toList();
        String access = jwtService.generateAccessToken(user.getUsername(), roles);

        // rotate: revoke the old refresh token, issue a new one
        stored.setRevoked(true);
        refreshTokenRepository.save(stored);
        String newRefresh = issueRefreshToken(user);

        return new TokenResponse(access, newRefresh, user.getUsername(), user.getFullName(), roles);
    }

    @Transactional
    public void logout(String refreshTokenValue) {
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) return;
        refreshTokenRepository.findByTokenHash(jwtService.hash(refreshTokenValue))
                .ifPresent(t -> { t.setRevoked(true); refreshTokenRepository.save(t); });
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
