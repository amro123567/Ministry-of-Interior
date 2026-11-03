package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * An elected local official who attests to documents and facts at the
 * village/neighbourhood level -- a legally recognised step in Lebanese
 * civil procedure. {@code termStart}/{@code termEnd} record the mukhtar's
 * elected term; whether a given attestation date falls within that term
 * is a service-layer rule for a later item (attestations aren't modelled
 * yet), not something enforceable as a column constraint.
 */
@Entity
@Table(name = "mukhtars")
public class Mukhtar extends ReferenceRecord {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "district_id")
    private District district;

    @Column(nullable = false, length = 80)
    private String firstNameEn;

    @Column(nullable = false, length = 80)
    private String lastNameEn;

    @Column(length = 80)
    private String firstNameAr;

    @Column(length = 80)
    private String lastNameAr;

    @Column(length = 150)
    private String villageOrNeighborhood;

    @Column(length = 30)
    private String phone;

    @Column(length = 120)
    private String email;

    @Column(nullable = false)
    private LocalDate termStart;

    private LocalDate termEnd;

    public District getDistrict() { return district; }
    public void setDistrict(District district) { this.district = district; }
    public String getFirstNameEn() { return firstNameEn; }
    public void setFirstNameEn(String firstNameEn) { this.firstNameEn = firstNameEn; }
    public String getLastNameEn() { return lastNameEn; }
    public void setLastNameEn(String lastNameEn) { this.lastNameEn = lastNameEn; }
    public String getFirstNameAr() { return firstNameAr; }
    public void setFirstNameAr(String firstNameAr) { this.firstNameAr = firstNameAr; }
    public String getLastNameAr() { return lastNameAr; }
    public void setLastNameAr(String lastNameAr) { this.lastNameAr = lastNameAr; }
    public String getVillageOrNeighborhood() { return villageOrNeighborhood; }
    public void setVillageOrNeighborhood(String villageOrNeighborhood) { this.villageOrNeighborhood = villageOrNeighborhood; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public LocalDate getTermStart() { return termStart; }
    public void setTermStart(LocalDate termStart) { this.termStart = termStart; }
    public LocalDate getTermEnd() { return termEnd; }
    public void setTermEnd(LocalDate termEnd) { this.termEnd = termEnd; }
}
