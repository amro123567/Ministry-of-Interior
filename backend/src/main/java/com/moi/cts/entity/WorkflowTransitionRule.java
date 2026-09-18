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

    /** The minimum role allowed to perform this transition. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RoleName requiredRole;

    public WorkflowTransitionRule() {}

    public WorkflowTransitionRule(RequestStatus fromStatus, RequestStatus toStatus, RoleName requiredRole) {
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.requiredRole = requiredRole;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public RequestStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(RequestStatus fromStatus) { this.fromStatus = fromStatus; }
    public RequestStatus getToStatus() { return toStatus; }
    public void setToStatus(RequestStatus toStatus) { this.toStatus = toStatus; }
    public RoleName getRequiredRole() { return requiredRole; }
    public void setRequiredRole(RoleName requiredRole) { this.requiredRole = requiredRole; }
}
