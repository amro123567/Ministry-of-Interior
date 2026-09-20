package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Legal guardianship of a minor. Guardianship requires court authority
 * (Lebanese personal-status law), hence the mandatory {@code court} link
 * -- there is deliberately no path to create one without a court decision
 * number and an identified court, enforced in {@code CitizenRegistryService}.
 * Among the most restricted data in the system: it concerns minors.
 */
@Entity
@Table(name = "guardianship_records")
public class GuardianshipRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "minor_citizen_id")
    private Citizen minorCitizen;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "guardian_citizen_id")
    private Citizen guardianCitizen;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GuardianshipType guardianshipType;

    @Column(name = "court_decision_number", nullable = false, length = 60)
    private String courtDecisionNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "court_id")
    private Court court;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GuardianshipStatus status = GuardianshipStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUser createdBy;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
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
    public Citizen getMinorCitizen() { return minorCitizen; }
    public void setMinorCitizen(Citizen minorCitizen) { this.minorCitizen = minorCitizen; }
    public Citizen getGuardianCitizen() { return guardianCitizen; }
    public void setGuardianCitizen(Citizen guardianCitizen) { this.guardianCitizen = guardianCitizen; }
    public GuardianshipType getGuardianshipType() { return guardianshipType; }
    public void setGuardianshipType(GuardianshipType guardianshipType) { this.guardianshipType = guardianshipType; }
    public String getCourtDecisionNumber() { return courtDecisionNumber; }
    public void setCourtDecisionNumber(String courtDecisionNumber) { this.courtDecisionNumber = courtDecisionNumber; }
    public Court getCourt() { return court; }
    public void setCourt(Court court) { this.court = court; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public GuardianshipStatus getStatus() { return status; }
    public void setStatus(GuardianshipStatus status) { this.status = status; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
