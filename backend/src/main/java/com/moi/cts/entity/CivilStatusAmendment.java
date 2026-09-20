package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A legally authorised change to one field on a citizen's record. The
 * most important integrity rule in this domain: an amendment requires a
 * non-empty {@code legalBasis} before it can be approved (SI-11), and
 * its approver must differ from whoever requested it (SI-12) -- both
 * enforced in {@code CitizenRegistryService}, not left as an
 * unconstrained string the way the source ERD leaves {@code status}.
 */
@Entity
@Table(name = "civil_status_amendments")
public class CivilStatusAmendment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "citizen_id")
    private Citizen citizen;

    @Column(name = "field_changed", nullable = false, length = 60)
    private String fieldChanged;

    @Column(name = "old_value", length = 500)
    private String oldValue;

    @Column(name = "new_value", length = 500)
    private String newValue;

    @Column(name = "legal_basis", nullable = false, length = 500)
    private String legalBasis;

    @Column(name = "court_decision_number", length = 60)
    private String courtDecisionNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "court_id")
    private Court court;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requested_by")
    private AppUser requestedBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private AppUser approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "amendment_date")
    private LocalDate amendmentDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApprovalStatus status = ApprovalStatus.PENDING;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Citizen getCitizen() { return citizen; }
    public void setCitizen(Citizen citizen) { this.citizen = citizen; }
    public String getFieldChanged() { return fieldChanged; }
    public void setFieldChanged(String fieldChanged) { this.fieldChanged = fieldChanged; }
    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }
    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }
    public String getLegalBasis() { return legalBasis; }
    public void setLegalBasis(String legalBasis) { this.legalBasis = legalBasis; }
    public String getCourtDecisionNumber() { return courtDecisionNumber; }
    public void setCourtDecisionNumber(String courtDecisionNumber) { this.courtDecisionNumber = courtDecisionNumber; }
    public Court getCourt() { return court; }
    public void setCourt(Court court) { this.court = court; }
    public AppUser getRequestedBy() { return requestedBy; }
    public void setRequestedBy(AppUser requestedBy) { this.requestedBy = requestedBy; }
    public AppUser getApprovedBy() { return approvedBy; }
    public void setApprovedBy(AppUser approvedBy) { this.approvedBy = approvedBy; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
    public LocalDate getAmendmentDate() { return amendmentDate; }
    public void setAmendmentDate(LocalDate amendmentDate) { this.amendmentDate = amendmentDate; }
    public ApprovalStatus getStatus() { return status; }
    public void setStatus(ApprovalStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
}
