package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * A judicial body whose decisions authorise registry changes (guardianship,
 * civil-status amendments, marriage/divorce certificates). Under Lebanon's
 * confessional personal-status system, a court decision number without an
 * identified court is not verifiable -- which is why courts are modelled
 * as their own entity rather than a free-text string on the documents that
 * reference them.
 */
@Entity
@Table(name = "courts")
public class Court extends ReferenceRecord {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "district_id")
    private District district;

    @Column(nullable = false, length = 150)
    private String nameEn;

    @Column(length = 150)
    private String nameAr;

    @Enumerated(EnumType.STRING)
    @Column(name = "court_type", nullable = false, length = 20)
    private CourtType courtType;

    @Column(length = 150)
    private String jurisdiction;

    public District getDistrict() { return district; }
    public void setDistrict(District district) { this.district = district; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
    public CourtType getCourtType() { return courtType; }
    public void setCourtType(CourtType courtType) { this.courtType = courtType; }
    public String getJurisdiction() { return jurisdiction; }
    public void setJurisdiction(String jurisdiction) { this.jurisdiction = jurisdiction; }
}
