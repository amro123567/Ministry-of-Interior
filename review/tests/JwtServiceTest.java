package com.moi.cts.security;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private final JwtService jwtService = new JwtService(
            "unit-test-secret-at-least-32-bytes-long", 30, 7);

    @Test
    void generatesATokenThatCarriesTheUsernameAndRoles() {
        String token = jwtService.generateAccessToken("officer", List.of("OFFICER"));
        assertEquals("officer", jwtService.extractUsername(token));
        assertEquals(List.of("OFFICER"), jwtService.extractRoles(token));
    }

    @Test
    void tokenIsValidForTheUserItWasIssuedTo() {
        String token = jwtService.generateAccessToken("manager", List.of("MANAGER"));
        assertTrue(jwtService.isTokenValid(token, "manager"));
        assertFalse(jwtService.isTokenValid(token, "someone-else"));
    }

    @Test
    void hashOfTheSameRefreshTokenValueIsStable() {
        String value = jwtService.generateRefreshTokenValue();
        assertEquals(jwtService.hash(value), jwtService.hash(value));
    }

    @Test
    void hashOfDifferentRefreshTokenValuesDiffers() {
        assertNotEquals(
                jwtService.hash(jwtService.generateRefreshTokenValue()),
                jwtService.hash(jwtService.generateRefreshTokenValue()));
    }

    @Test
    void rejectsATokenSignedWithADifferentSecret() {
        JwtService other = new JwtService("a-completely-different-secret-32-bytes!", 30, 7);
        String token = other.generateAccessToken("officer", List.of("OFFICER"));
        assertThrows(Exception.class, () -> jwtService.extractUsername(token));
    }
}
