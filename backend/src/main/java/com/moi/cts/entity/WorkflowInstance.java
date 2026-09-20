package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A running instance of the admin-configured workflow, tracking exactly
 * one "subject" through the {@link WorkflowState} catalog by a
 * ({@code entityType}, {@code entityId}) pair rather than a hard FK to
 * any one domain table.
 *
 * <p>This entity has <strong>no counterpart in the corrected ERD</strong>
 * -- disclosed deliberately, not an oversight. The ERD's literal design
 * ties {@code workflow_state_id} directly onto {@code service_requests}
 * (i.e. it assumes the configurable engine replaces
 * {@link CorrespondenceRequest}'s own {@link RequestStatus} enum
 * outright). Doing that migration for real would mean rewriting
 * {@code RequestService.transition()}, every {@code @PreAuthorize}/
 * permission check built on {@code RequestStatus}, every DTO that
 * exposes a status string, and the frontend's hardcoded
 * {@code TRANSITIONS} map -- exactly the "re-deriving every hardcoded
 * transition check" cost {@code FULL_DATABASE_MIGRATION_ANALYSIS.md}
 * itself warns is a separate, much larger undertaking than adding the
 * configuration tables. So this item builds the engine as a real,
 * independently testable subsystem -- instances actually move through
 * states, permission-gated, with history -- without touching the
 * already-tested request domain at all. Wiring
 * {@code CorrespondenceRequest} itself onto this engine (making
 * {@code entityType = "CorrespondenceRequest"} the live path) is exactly
 * the kind of follow-on integration a future item could tackle once this
 * groundwork exists.
 */
@Entity
@Table(name = "workflow_instances",
       uniqueConstraints = @UniqueConstraint(columnNames = {"entity_type", "entity_id"}))
public class WorkflowInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entity_type", nullable = false, length = 60)
    private String entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "current_state_id")
    private WorkflowState currentState;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
    public WorkflowState getCurrentState() { return currentState; }
    public void setCurrentState(WorkflowState currentState) { this.currentState = currentState; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
