package com.moi.cts.service;

import com.moi.cts.dto.UserDtos.*;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.Office;
import com.moi.cts.entity.Role;
import com.moi.cts.entity.RoleName;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.OfficeRepository;
import com.moi.cts.repository.RoleRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

@Service
public class UserService {

    private final AppUserRepository userRepository;
    private final RoleRepository roleRepository;
    private final OfficeRepository officeRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(AppUserRepository userRepository, RoleRepository roleRepository,
                        OfficeRepository officeRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.officeRepository = officeRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UserDto> all() {
        return userRepository.findAll().stream().map(this::toDto).toList();
    }

    @Transactional
    public UserDto create(CreateUserRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new BadRequestException("Username already in use: " + request.username());
        }
        RoleName roleName;
        try {
            roleName = RoleName.valueOf(request.roleName().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown role: " + request.roleName());
        }
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new NotFoundException("Role not seeded: " + roleName));

        AppUser user = new AppUser();
        user.setUsername(request.username());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setRoles(new HashSet<>(List.of(role)));
        if (request.officeId() != null) {
            Office office = officeRepository.findById(request.officeId())
                    .orElseThrow(() -> new NotFoundException("Office not found: " + request.officeId()));
            user.setOffice(office);
        }
        return toDto(userRepository.save(user));
    }

    private UserDto toDto(AppUser u) {
        return new UserDto(u.getId(), u.getUsername(), u.getFullName(), u.getEmail(), u.isEnabled(),
                u.getRoles().stream().map(r -> r.getName().name()).toList(),
                u.getOffice() != null ? u.getOffice().getNameEn() : null);
    }
}
