package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * One citizen's historical membership in a family record. Membership is
 * historical, not current-state: leaving a family record closes a row
 * ({@code leftDate}/{@code leftReason}) rather than deleting it, so
 * household composition can be reconstructed at any past date.
 * <p>
 * The corrected ERD's own {@code UNIQUE(family_record_id, citizen_id)}
 * is flagged in the design docs as a defect -- it would block a citizen
 * from ever rejoining a family record they previously left (e.g. a
 * divorce returning someone to their birth family's book). This entity
 * uses the design docs' own recommended fix,
 * {@code UNIQUE(family_record_id, citizen_id, joined_date)}, instead of
 * reproducing the flaw.
 */
@Entity
@Table(name = "family_members",
        uniqueConstraints = @UniqueConstraint(columnNames = {"family_record_id", "citizen_id", "joined_date"}))
public class FamilyMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "family_record_id")
    private FamilyRecord familyRecord;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "citizen_id")
    private Citizen citizen;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private FamilyRelationship relationship;

    @Column(name = "joined_date", nullable = false)
    private LocalDate joinedDate;

    @Column(name = "left_date")
    private LocalDate leftDate;

    @Column(name = "left_reason", length = 255)
    private String leftReason;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public FamilyRecord getFamilyRecord() { return familyRecord; }
    public void setFamilyRecord(FamilyRecord familyRecord) { this.familyRecord = familyRecord; }
    public Citizen getCitizen() { return citizen; }
    public void setCitizen(Citizen citizen) { this.citizen = citizen; }
    public FamilyRelationship getRelationship() { return relationship; }
    public void setRelationship(FamilyRelationship relationship) { this.relationship = relationship; }
    public LocalDate getJoinedDate() { return joinedDate; }
    public void setJoinedDate(LocalDate joinedDate) { this.joinedDate = joinedDate; }
    public LocalDate getLeftDate() { return leftDate; }
    public void setLeftDate(LocalDate leftDate) { this.leftDate = leftDate; }
    public String getLeftReason() { return leftReason; }
    public void setLeftReason(String leftReason) { this.leftReason = leftReason; }
    public Instant getCreatedAt() { return createdAt; }
}
