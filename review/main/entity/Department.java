package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * A functional unit an employee belongs to (e.g. "Nationality &amp; Cases").
 * Self-referencing via {@code parent} for an org chart, per the corrected
 * ERD -- but, faithfully to that same ERD, deliberately has no link to
 * {@link Office}. The design docs (CTS_Software_Design_Document.md,
 * D-16) flag this as an open question rather than a settled decision:
 * is a department a national function that exists once, or a unit
 * within each office? That ambiguity is preserved here rather than
 * silently resolved one way, since resolving it would mean guessing at
 * an answer the source documents themselves don't commit to.
 */
@Entity
@Table(name = "departments")
public class Department extends ReferenceRecord {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Department parent;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false, length = 150)
    private String nameEn;

    @Column(length = 150)
    private String nameAr;

    @Column(length = 500)
    private String description;

    public Department getParent() { return parent; }
    public void setParent(Department parent) { this.parent = parent; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
