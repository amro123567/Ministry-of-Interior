package com.moi.cts.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "document_types")
public class DocumentType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 150)
    private String nameEn;

    @Column(length = 150)
    private String nameAr;

    /** Business-day SLA target used to compute {@code dueAt} on a new request. */
    @Column(nullable = false)
    private int slaDays = 5;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
    public int getSlaDays() { return slaDays; }
    public void setSlaDays(int slaDays) { this.slaDays = slaDays; }
}
