package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * The legal-transition matrix (SDD 6.5.7 rule set, carried over from the
 * SQLite/MySQL trigger {@code trg_request_legal_transition}) as data instead
 * of a trigger, since the service layer is now the place that owns workflow
 * rules. Seeded once; read at every transition attempt.
 */
@Entity
@Table(name = "workflow_transition_rules",
       uniqueConstraints = @UniqueConstraint(columnNames = {"fromStatus", "toStatus"}))
public class WorkflowTransitionRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus toStatus;

    /**
     * The permission a user must hold (through any of their roles) to
     * perform this transition -- replaces the old hardcoded
     * {@code RoleName requiredRole} field. Whoever holds this permission
     * can perform the transition; there is no separate "ADMIN can do
     * anything" special case in code any more; ADMIN can perform every
     * transition simply because the seeded ADMIN role is granted every
     * permission (see DataSeeder).
     */
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "required_permission_id")
    private Permission requiredPermission;

    public WorkflowTransitionRule() {}

    public WorkflowTransitionRule(RequestStatus fromStatus, RequestStatus toStatus, Permission requiredPermission) {
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.requiredPermission = requiredPermission;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public RequestStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(RequestStatus fromStatus) { this.fromStatus = fromStatus; }
    public RequestStatus getToStatus() { return toStatus; }
    public void setToStatus(RequestStatus toStatus) { this.toStatus = toStatus; }
    public Permission getRequiredPermission() { return requiredPermission; }
    public void setRequiredPermission(Permission requiredPermission) { this.requiredPermission = requiredPermission; }
}
