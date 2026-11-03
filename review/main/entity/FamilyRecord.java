package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A family book (sijill 'a'ili) grouping citizens under a head of
 * household. Deactivated, never deleted, per the reference-domain rule
 * (though this itself is a registry, not a reference, entity -- kept
 * consistent with it anyway since the same "never delete a record other
 * data depends on" reasoning applies).
 */
@Entity
@Table(name = "family_records")
public class FamilyRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "family_book_number", nullable = false, unique = true, length = 40)
    private String familyBookNumber;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "head_of_household_id")
    private Citizen headOfHousehold;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registration_office_id")
    private Office registrationOffice;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

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
    public String getFamilyBookNumber() { return familyBookNumber; }
    public void setFamilyBookNumber(String familyBookNumber) { this.familyBookNumber = familyBookNumber; }
    public Citizen getHeadOfHousehold() { return headOfHousehold; }
    public void setHeadOfHousehold(Citizen headOfHousehold) { this.headOfHousehold = headOfHousehold; }
    public Office getRegistrationOffice() { return registrationOffice; }
    public void setRegistrationOffice(Office registrationOffice) { this.registrationOffice = registrationOffice; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
