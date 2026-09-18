package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class UserDtos {

    public record UserDto(Long id, String username, String fullName, String email,
                           boolean enabled, List<String> roles, String officeName) {}

    public record CreateUserRequest(@NotBlank String username, @NotBlank String password,
                                     @NotBlank String fullName, String email,
                                     @NotBlank String roleName, Long officeId) {}
}
