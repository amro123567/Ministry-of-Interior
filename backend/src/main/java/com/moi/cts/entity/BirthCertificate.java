package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * Subtype row for a birth certificate. Uses shared-primary-key mapping
 * (Class Table Inheritance): {@code documentId} is both this row's own
 * primary key and its foreign key to the parent {@link Document}, via
 * {@code @MapsId} -- exactly the ERD's {@code document_id bigint pk fk}.
 */
@Entity
@Table(name = "birth_certificates")
public class BirthCertificate {

    @Id
    private Long documentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "document_id")
    private Document document;

    @Column(length = 150)
    private String birthPlace;

    @Column(length = 150)
    private String birthHospital;

    @Column(length = 150)
    private String birthAttendant;

    // Snapshotted, not resolved live from citizens.father_id/mother_id --
    // a birth certificate must show the parents' names *as they were at
    // the time of birth*, which a live FK lookup would silently rewrite
    // if a parent's name is later corrected via a civil status amendment.
    @Column(length = 200)
    private String fatherFullNameSnapshot;

    @Column(length = 200)
    private String motherFullNameSnapshot;

    @Column(length = 60)
    private String registrationNumber;

    @Column(length = 150)
    private String registrarName;

    public Long getDocumentId() { return documentId; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public String getBirthPlace() { return birthPlace; }
    public void setBirthPlace(String birthPlace) { this.birthPlace = birthPlace; }
    public String getBirthHospital() { return birthHospital; }
    public void setBirthHospital(String birthHospital) { this.birthHospital = birthHospital; }
    public String getBirthAttendant() { return birthAttendant; }
    public void setBirthAttendant(String birthAttendant) { this.birthAttendant = birthAttendant; }
    public String getFatherFullNameSnapshot() { return fatherFullNameSnapshot; }
    public void setFatherFullNameSnapshot(String v) { this.fatherFullNameSnapshot = v; }
    public String getMotherFullNameSnapshot() { return motherFullNameSnapshot; }
    public void setMotherFullNameSnapshot(String v) { this.motherFullNameSnapshot = v; }
    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }
    public String getRegistrarName() { return registrarName; }
    public void setRegistrarName(String registrarName) { this.registrarName = registrarName; }
}
