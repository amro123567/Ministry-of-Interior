package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * The top level of Lebanon's administrative division (8 governorates).
 * Modelled as data rather than an enum because governorate boundaries are
 * politically mutable -- Lebanon's governorates were last restructured in
 * 2014 (Akkar and Baalbek-Hermel split off) -- so a boundary change should
 * be an admin edit, not a code change and redeploy.
 */
@Entity
@Table(name = "governorates")
public class Governorate extends ReferenceRecord {

    @Column(nullable = false, unique = true, length = 10)
    private String code;

    @Column(nullable = false, length = 100)
    private String nameEn;

    @Column(length = 100)
    private String nameAr;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
}
