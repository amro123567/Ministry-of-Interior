package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Movement of a citizen's registry between offices -- modelled as an
 * event with an approval workflow, not a field update, so the complete
 * custody history (which office held the record, when, under whose
 * authority) survives. Separate {@code requestedBy}/{@code approvedBy}
 * columns encode segregation of duties structurally; {@code approvedBy}
 * must differ from {@code requestedBy}, enforced in
 * {@code CitizenRegistryService} (SI-12).
 */
@Entity
@Table(name = "registry_transfers")
public class RegistryTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "citizen_id")
    private Citizen citizen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "family_record_id")
    private FamilyRecord familyRecord;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_office_id")
    private Office fromOffice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_office_id")
    private Office toOffice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requested_by")
    private AppUser requestedBy;

    @Column(name = "requested_at", nullable = false)
    private Instant requestedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approved_by")
    private AppUser approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "decision_reference", length = 80)
    private String decisionReference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ApprovalStatus status = ApprovalStatus.PENDING;

    @Column(name = "transfer_date")
    private LocalDate transferDate;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        if (requestedAt == null) requestedAt = createdAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Citizen getCitizen() { return citizen; }
    public void setCitizen(Citizen citizen) { this.citizen = citizen; }
    public FamilyRecord getFamilyRecord() { return familyRecord; }
    public void setFamilyRecord(FamilyRecord familyRecord) { this.familyRecord = familyRecord; }
    public Office getFromOffice() { return fromOffice; }
    public void setFromOffice(Office fromOffice) { this.fromOffice = fromOffice; }
    public Office getToOffice() { return toOffice; }
    public void setToOffice(Office toOffice) { this.toOffice = toOffice; }
    public AppUser getRequestedBy() { return requestedBy; }
    public void setRequestedBy(AppUser requestedBy) { this.requestedBy = requestedBy; }
    public Instant getRequestedAt() { return requestedAt; }
    public void setRequestedAt(Instant requestedAt) { this.requestedAt = requestedAt; }
    public AppUser getApprovedBy() { return approvedBy; }
    public void setApprovedBy(AppUser approvedBy) { this.approvedBy = approvedBy; }
    public Instant getApprovedAt() { return approvedAt; }
    public void setApprovedAt(Instant approvedAt) { this.approvedAt = approvedAt; }
    public String getDecisionReference() { return decisionReference; }
    public void setDecisionReference(String decisionReference) { this.decisionReference = decisionReference; }
    public ApprovalStatus getStatus() { return status; }
    public void setStatus(ApprovalStatus status) { this.status = status; }
    public LocalDate getTransferDate() { return transferDate; }
    public void setTransferDate(LocalDate transferDate) { this.transferDate = transferDate; }
    public Instant getCreatedAt() { return createdAt; }
}
