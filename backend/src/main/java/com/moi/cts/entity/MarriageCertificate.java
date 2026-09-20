package com.moi.cts.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "marriage_certificates")
public class MarriageCertificate {

    @Id
    private Long documentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "document_id")
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "husband_id")
    private Citizen husband;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wife_id")
    private Citizen wife;

    // Snapshotted alongside the live FKs above -- see BirthCertificate's
    // Javadoc for why a certificate needs names as of the event, not as
    // of whenever it's later read.
    @Column(length = 200)
    private String husbandNameSnapshot;

    @Column(length = 200)
    private String wifeNameSnapshot;

    private LocalDate marriageDate;

    @Column(length = 150)
    private String marriagePlace;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "court_id")
    private Court court;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "religious_authority_id")
    private ReligiousAuthority religiousAuthority;

    @Column(unique = true, length = 60)
    private String contractNumber;

    private BigDecimal dowryAmount;

    @Column(length = 3)
    private String dowryCurrency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UnionStatus status = UnionStatus.ACTIVE;

    public Long getDocumentId() { return documentId; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public Citizen getHusband() { return husband; }
    public void setHusband(Citizen husband) { this.husband = husband; }
    public Citizen getWife() { return wife; }
    public void setWife(Citizen wife) { this.wife = wife; }
    public String getHusbandNameSnapshot() { return husbandNameSnapshot; }
    public void setHusbandNameSnapshot(String v) { this.husbandNameSnapshot = v; }
    public String getWifeNameSnapshot() { return wifeNameSnapshot; }
    public void setWifeNameSnapshot(String v) { this.wifeNameSnapshot = v; }
    public LocalDate getMarriageDate() { return marriageDate; }
    public void setMarriageDate(LocalDate marriageDate) { this.marriageDate = marriageDate; }
    public String getMarriagePlace() { return marriagePlace; }
    public void setMarriagePlace(String marriagePlace) { this.marriagePlace = marriagePlace; }
    public Court getCourt() { return court; }
    public void setCourt(Court court) { this.court = court; }
    public ReligiousAuthority getReligiousAuthority() { return religiousAuthority; }
    public void setReligiousAuthority(ReligiousAuthority religiousAuthority) { this.religiousAuthority = religiousAuthority; }
    public String getContractNumber() { return contractNumber; }
    public void setContractNumber(String contractNumber) { this.contractNumber = contractNumber; }
    public BigDecimal getDowryAmount() { return dowryAmount; }
    public void setDowryAmount(BigDecimal dowryAmount) { this.dowryAmount = dowryAmount; }
    public String getDowryCurrency() { return dowryCurrency; }
    public void setDowryCurrency(String dowryCurrency) { this.dowryCurrency = dowryCurrency; }
    public UnionStatus getStatus() { return status; }
    public void setStatus(UnionStatus status) { this.status = status; }
}
