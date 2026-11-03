package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * The authoritative civil status record for a registered person. The
 * corrected ERD makes {@code civil_registry_number} the actual primary
 * key (a natural key referenced by ~20 other tables) -- this entity
 * deliberately keeps the existing surrogate {@code id} instead. Migrating
 * the primary key would touch every table/DTO/frontend screen that
 * already references {@code Citizen.id} (CorrespondenceRequest chief
 * among them) purely to match the ERD's key choice, with no behavior
 * change to justify the risk to already-working, already-tested code.
 * {@code registryNumber} still carries the unique natural identifier;
 * the self-referencing lineage below uses the surrogate {@code id} as
 * its FK type instead of {@code registryNumber}, which is the one
 * adaptation that choice requires.
 */
@Entity
@Table(name = "citizens")
public class Citizen {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String registryNumber;

    @Column(nullable = false, length = 100)
    private String firstNameEn;

    @Column(length = 100)
    private String middleNameEn;

    @Column(length = 100)
    private String lastNameEn;

    @Column(length = 100)
    private String firstNameAr;

    @Column(length = 100)
    private String middleNameAr;

    @Column(length = 100)
    private String lastNameAr;

    // Lineage (ERD FR-02/SI-1/SI-3/SI-4). Nullable: most citizens either
    // have no registered parent on file, or have an unregistered one
    // recorded only as free text -- see fatherNameUnregistered/
    // motherNameUnregistered and CitizenService's XOR validation.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "father_id")
    private Citizen father;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mother_id")
    private Citizen mother;

    @Column(length = 200)
    private String fatherNameUnregistered;

    @Column(length = 200)
    private String motherNameUnregistered;

    private LocalDate dateOfBirth;

    @Column(length = 150)
    private String placeOfBirth;

    @Column(length = 10)
    private String gender;

    @Column(length = 50)
    private String religion;

    @Column(length = 50)
    private String sect;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private MaritalStatus maritalStatus;

    @Column(length = 50)
    private String sijillReference;

    @Column(length = 60)
    private String nationality;

    @Column(nullable = false)
    private boolean deceased = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "registered_office_id")
    private Office registeredOffice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUser createdBy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private AppUser updatedBy;

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
    public String getRegistryNumber() { return registryNumber; }
    public void setRegistryNumber(String registryNumber) { this.registryNumber = registryNumber; }
    public String getFirstNameEn() { return firstNameEn; }
    public void setFirstNameEn(String firstNameEn) { this.firstNameEn = firstNameEn; }
    public String getMiddleNameEn() { return middleNameEn; }
    public void setMiddleNameEn(String middleNameEn) { this.middleNameEn = middleNameEn; }
    public String getLastNameEn() { return lastNameEn; }
    public void setLastNameEn(String lastNameEn) { this.lastNameEn = lastNameEn; }
    public String getFirstNameAr() { return firstNameAr; }
    public void setFirstNameAr(String firstNameAr) { this.firstNameAr = firstNameAr; }
    public String getMiddleNameAr() { return middleNameAr; }
    public void setMiddleNameAr(String middleNameAr) { this.middleNameAr = middleNameAr; }
    public String getLastNameAr() { return lastNameAr; }
    public void setLastNameAr(String lastNameAr) { this.lastNameAr = lastNameAr; }
    public Citizen getFather() { return father; }
    public void setFather(Citizen father) { this.father = father; }
    public Citizen getMother() { return mother; }
    public void setMother(Citizen mother) { this.mother = mother; }
    public String getFatherNameUnregistered() { return fatherNameUnregistered; }
    public void setFatherNameUnregistered(String fatherNameUnregistered) { this.fatherNameUnregistered = fatherNameUnregistered; }
    public String getMotherNameUnregistered() { return motherNameUnregistered; }
    public void setMotherNameUnregistered(String motherNameUnregistered) { this.motherNameUnregistered = motherNameUnregistered; }
    public LocalDate getDateOfBirth() { return dateOfBirth; }
    public void setDateOfBirth(LocalDate dateOfBirth) { this.dateOfBirth = dateOfBirth; }
    public String getPlaceOfBirth() { return placeOfBirth; }
    public void setPlaceOfBirth(String placeOfBirth) { this.placeOfBirth = placeOfBirth; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public String getReligion() { return religion; }
    public void setReligion(String religion) { this.religion = religion; }
    public String getSect() { return sect; }
    public void setSect(String sect) { this.sect = sect; }
    public MaritalStatus getMaritalStatus() { return maritalStatus; }
    public void setMaritalStatus(MaritalStatus maritalStatus) { this.maritalStatus = maritalStatus; }
    public String getSijillReference() { return sijillReference; }
    public void setSijillReference(String sijillReference) { this.sijillReference = sijillReference; }
    public String getNationality() { return nationality; }
    public void setNationality(String nationality) { this.nationality = nationality; }
    public boolean isDeceased() { return deceased; }
    public void setDeceased(boolean deceased) { this.deceased = deceased; }
    public Office getRegisteredOffice() { return registeredOffice; }
    public void setRegisteredOffice(Office registeredOffice) { this.registeredOffice = registeredOffice; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public AppUser getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(AppUser updatedBy) { this.updatedBy = updatedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
