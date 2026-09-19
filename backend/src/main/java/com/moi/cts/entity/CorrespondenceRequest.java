package com.moi.cts.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "correspondence_requests")
public class CorrespondenceRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 30)
    private String referenceNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "citizen_id")
    private Citizen citizen;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_type_id")
    private DocumentType documentType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "office_id")
    private Office office;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_id")
    private AppUser assignedTo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_id")
    private AppUser createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestStatus status = RequestStatus.DRAFT;

    @Column(length = 20)
    private String priority = "NORMAL";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(length = 300)
    private String rejectionReason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    private Instant submittedAt;
    private Instant dueAt;
    private Instant closedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getReferenceNumber() { return referenceNumber; }
    public void setReferenceNumber(String referenceNumber) { this.referenceNumber = referenceNumber; }
    public Citizen getCitizen() { return citizen; }
    public void setCitizen(Citizen citizen) { this.citizen = citizen; }
    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }
    public Office getOffice() { return office; }
    public void setOffice(Office office) { this.office = office; }
    public AppUser getAssignedTo() { return assignedTo; }
    public void setAssignedTo(AppUser assignedTo) { this.assignedTo = assignedTo; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public RequestStatus getStatus() { return status; }
    public void setStatus(RequestStatus status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(Instant submittedAt) { this.submittedAt = submittedAt; }
    public Instant getDueAt() { return dueAt; }
    public void setDueAt(Instant dueAt) { this.dueAt = dueAt; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }

    public boolean isOverdue() {
        return dueAt != null && closedAt == null
                && status != RequestStatus.ARCHIVED && status != RequestStatus.REJECTED
                && Instant.now().isAfter(dueAt);
    }

    /**
     * SLA status derived live from dueAt/closedAt/status, not stored or
     * synced by a scheduled job -- a computed property can't drift out of
     * sync with the data it's computed from, which a separate SLA-status
     * table updated on a timer could. "Due soon" was previously only
     * computed client-side (48h window in the frontend's SlaBadge); it's
     * now authoritative here so every consumer (API, CSV export, future
     * clients) agrees on it.
     */
    public SlaStatus getSlaStatus() {
        if (dueAt == null) return SlaStatus.ON_TRACK;
        if (isOverdue()) return SlaStatus.OVERDUE;
        boolean open = closedAt == null && status != RequestStatus.ARCHIVED && status != RequestStatus.REJECTED;
        if (open && Instant.now().isAfter(dueAt.minus(48, ChronoUnit.HOURS))) {
            return SlaStatus.DUE_SOON;
        }
        return SlaStatus.ON_TRACK;
    }
}
