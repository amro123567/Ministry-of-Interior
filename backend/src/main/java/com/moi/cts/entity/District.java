package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * The "qada" level (~25-26 districts). This is the level at which courts
 * and mukhtars have jurisdiction, which is why {@link Court} and
 * {@link Mukhtar} both reference a district rather than a governorate.
 */
@Entity
@Table(name = "districts", uniqueConstraints = @UniqueConstraint(columnNames = {"governorate_id", "code"}))
public class District extends ReferenceRecord {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "governorate_id")
    private Governorate governorate;

    @Column(nullable = false, length = 10)
    private String code;

    @Column(nullable = false, length = 100)
    private String nameEn;

    @Column(length = 100)
    private String nameAr;

    public Governorate getGovernorate() { return governorate; }
    public void setGovernorate(Governorate governorate) { this.governorate = governorate; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
}
