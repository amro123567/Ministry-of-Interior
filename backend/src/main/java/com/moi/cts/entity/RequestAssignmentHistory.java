package com.moi.cts.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;
import java.time.Instant;

/**
 * Append-only assignment log, mirroring how {@link RequestStateHistory}
 * already sits alongside {@code CorrespondenceRequest.status}: the
 * request keeps a fast "current assignee" pointer (assignedTo) for
 * everyday reads, and every change to it is also recorded here so the
 * history is queryable without walking the audit log.
 */
@Immutable
@Entity
@Table(name = "request_assignment_history")
public class RequestAssignmentHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "request_id")
    private CorrespondenceRequest request;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assigned_to_id")
    private AppUser assignedTo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assigned_by_id")
    private AppUser assignedBy;

    @Column(length = 300)
    private String note;

    @Column(nullable = false, updatable = false)
    private Instant assignedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public CorrespondenceRequest getRequest() { return request; }
    public void setRequest(CorrespondenceRequest request) { this.request = request; }
    public AppUser getAssignedTo() { return assignedTo; }
    public void setAssignedTo(AppUser assignedTo) { this.assignedTo = assignedTo; }
    public AppUser getAssignedBy() { return assignedBy; }
    public void setAssignedBy(AppUser assignedBy) { this.assignedBy = assignedBy; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }
}
