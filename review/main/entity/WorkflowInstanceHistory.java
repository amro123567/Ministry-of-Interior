package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * One executed transition of a {@link WorkflowInstance} -- mirrors the
 * already-established {@code request_state_history}/
 * {@code service_request_status_history} pattern (business history shown
 * as a timeline, kept separate from the general audit log) rather than
 * inventing a new history shape for this domain.
 */
@Entity
@Table(name = "workflow_instance_history")
public class WorkflowInstanceHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instance_id")
    private WorkflowInstance instance;

    @ManyToOne(fetch = FetchType.EAGER, optional = true)
    @JoinColumn(name = "from_state_id")
    private WorkflowState fromState;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "to_state_id")
    private WorkflowState toState;

    @ManyToOne(fetch = FetchType.EAGER, optional = true)
    @JoinColumn(name = "transition_id")
    private WorkflowTransition transition;

    @ManyToOne(fetch = FetchType.EAGER, optional = true)
    @JoinColumn(name = "actor_id")
    private AppUser actor;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(length = 500)
    private String comment;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public WorkflowInstance getInstance() { return instance; }
    public void setInstance(WorkflowInstance instance) { this.instance = instance; }
    public WorkflowState getFromState() { return fromState; }
    public void setFromState(WorkflowState fromState) { this.fromState = fromState; }
    public WorkflowState getToState() { return toState; }
    public void setToState(WorkflowState toState) { this.toState = toState; }
    public WorkflowTransition getTransition() { return transition; }
    public void setTransition(WorkflowTransition transition) { this.transition = transition; }
    public AppUser getActor() { return actor; }
    public void setActor(AppUser actor) { this.actor = actor; }
    public Instant getOccurredAt() { return occurredAt; }
    public void setOccurredAt(Instant occurredAt) { this.occurredAt = occurredAt; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
