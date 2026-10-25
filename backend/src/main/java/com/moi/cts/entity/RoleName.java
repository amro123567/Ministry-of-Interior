package com.moi.cts.entity;

/**
 * The four seeded roles. A role is only a named bundle of permissions
 * ({@code role_permissions}); controllers and {@code SecurityConfig} check
 * permission codes, never role names. See {@code DataSeeder} for the grants.
 */
public enum RoleName {
    ADMIN,
    MANAGER,
    OFFICER,
    VIEWER
}
