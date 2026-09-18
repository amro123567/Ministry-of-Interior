package com.moi.cts.entity;

/**
 * The four roles carried over from the Flask system's 14-role RBAC matrix,
 * collapsed to the granularity this vertical slice actually needs. See
 * SDD deviation note in README: fine-grained per-module permissions
 * (create/edit/delete/view x module) were descoped to role-gated policies
 * in {@code SecurityConfig} for the time available.
 */
public enum RoleName {
    ADMIN,
    MANAGER,
    OFFICER,
    VIEWER
}
