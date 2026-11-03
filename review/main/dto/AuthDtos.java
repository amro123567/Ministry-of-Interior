package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class AuthDtos {

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record TokenResponse(String accessToken, String refreshToken, String username,
                                 String fullName, List<String> roles, List<String> permissions) {}
}
