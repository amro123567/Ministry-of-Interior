package com.moi.cts.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "offices")
public class Office {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false, length = 150)
    private String nameEn;

    @Column(length = 150)
    private String nameAr;

    // Nullable: existing offices predate the reference/org hierarchy
    // (governorates -> districts -> offices) added alongside this field,
    // and nothing about office creation requires a district today. New
    // offices should set one; old seeded offices are backfilled in
    // DataSeeder rather than forced via a NOT NULL migration.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_id")
    private District district;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
    public District getDistrict() { return district; }
    public void setDistrict(District district) { this.district = district; }
}
