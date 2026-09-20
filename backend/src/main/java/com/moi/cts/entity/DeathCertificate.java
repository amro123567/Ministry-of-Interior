package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * Matches the corrected ERD's actual column list for this subtype
 * exactly (no separate {@code deceased_id} column beyond the parent
 * {@link Document}'s own {@code citizen} FK -- the SDD's narrative text
 * mentions one, but the ERD itself, which is authoritative for what's
 * built, does not carry it here).
 */
@Entity
@Table(name = "death_certificates")
public class DeathCertificate {

    @Id
    private Long documentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "document_id")
    private Document document;

    private LocalDate deathDate;

    @Column(length = 150)
    private String deathPlace;

    @Column(length = 255)
    private String deathCause;

    @Column(length = 150)
    private String certifyingPhysician;

    @Column(length = 150)
    private String burialPlace;

    private LocalDate burialDate;

    public Long getDocumentId() { return documentId; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public LocalDate getDeathDate() { return deathDate; }
    public void setDeathDate(LocalDate deathDate) { this.deathDate = deathDate; }
    public String getDeathPlace() { return deathPlace; }
    public void setDeathPlace(String deathPlace) { this.deathPlace = deathPlace; }
    public String getDeathCause() { return deathCause; }
    public void setDeathCause(String deathCause) { this.deathCause = deathCause; }
    public String getCertifyingPhysician() { return certifyingPhysician; }
    public void setCertifyingPhysician(String certifyingPhysician) { this.certifyingPhysician = certifyingPhysician; }
    public String getBurialPlace() { return burialPlace; }
    public void setBurialPlace(String burialPlace) { this.burialPlace = burialPlace; }
    public LocalDate getBurialDate() { return burialDate; }
    public void setBurialDate(LocalDate burialDate) { this.burialDate = burialDate; }
}
