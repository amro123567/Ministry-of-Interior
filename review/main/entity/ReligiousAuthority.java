package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * A confessional body that solemnises marriage and pronounces divorce.
 * Lebanon has no civil marriage performed domestically -- every marriage
 * is registered through a recognised religious authority -- so this
 * models a real legal actor in the domain, not incidental detail.
 */
@Entity
@Table(name = "religious_authorities")
public class ReligiousAuthority extends ReferenceRecord {

    @Column(nullable = false, length = 150)
    private String nameEn;

    @Column(length = 150)
    private String nameAr;

    @Column(nullable = false, length = 50)
    private String religion;

    @Column(length = 50)
    private String sect;

    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
    public String getReligion() { return religion; }
    public void setReligion(String religion) { this.religion = religion; }
    public String getSect() { return sect; }
    public void setSect(String sect) { this.sect = sect; }
}
