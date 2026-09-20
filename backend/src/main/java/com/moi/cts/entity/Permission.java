package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * A single grantable capability (e.g. {@code USER_MANAGE},
 * {@code REQUEST_TRANSITION_DECIDE}). Roles are granted a set of these
 * via {@code role_permissions} instead of authorization checks being
 * hardcoded against role names -- see {@link Role#getPermissions()} and
 * the note on {@link WorkflowTransitionRule#getRequiredPermission()} for
 * where this replaces the old {@code RoleName}-based checks.
 */
@Entity
@Table(name = "permissions")
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String code;

    @Column(length = 200)
    private String description;

    public Permission() {}

    public Permission(String code, String description) {
        this.code = code;
        this.description = description;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
