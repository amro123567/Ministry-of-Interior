package com.moi.cts.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "divorce_certificates")
public class DivorceCertificate {

    @Id
    private Long documentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "document_id")
    private Document document;

    // UNIQUE: the ERD enforces at most one divorce per marriage at the
    // database level -- one of the source schema's better-enforced rules,
    // called out explicitly in the SDD as worth keeping as-is.
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "marriage_certificate_id", unique = true)
    private MarriageCertificate marriageCertificate;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "husband_id")
    private Citizen husband;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "wife_id")
    private Citizen wife;

    private LocalDate divorceDate;

    @Column(length = 150)
    private String divorcePlace;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "court_id")
    private Court court;

    @Column(length = 60)
    private String courtDecisionNumber;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private DivorceType divorceType;

    @Lob
    private String divorceReason;

    @Lob
    private String childCustodyAgreement;

    @Lob
    private String financialSettlement;

    private BigDecimal settlementAmount;

    @Column(length = 3)
    private String settlementCurrency;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "religious_authority_id")
    private ReligiousAuthority religiousAuthority;

    @Column(length = 80)
    private String shariaCourtApproval;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecordStatus status = RecordStatus.ACTIVE;

    public Long getDocumentId() { return documentId; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public MarriageCertificate getMarriageCertificate() { return marriageCertificate; }
    public void setMarriageCertificate(MarriageCertificate marriageCertificate) { this.marriageCertificate = marriageCertificate; }
    public Citizen getHusband() { return husband; }
    public void setHusband(Citizen husband) { this.husband = husband; }
    public Citizen getWife() { return wife; }
    public void setWife(Citizen wife) { this.wife = wife; }
    public LocalDate getDivorceDate() { return divorceDate; }
    public void setDivorceDate(LocalDate divorceDate) { this.divorceDate = divorceDate; }
    public String getDivorcePlace() { return divorcePlace; }
    public void setDivorcePlace(String divorcePlace) { this.divorcePlace = divorcePlace; }
    public Court getCourt() { return court; }
    public void setCourt(Court court) { this.court = court; }
    public String getCourtDecisionNumber() { return courtDecisionNumber; }
    public void setCourtDecisionNumber(String courtDecisionNumber) { this.courtDecisionNumber = courtDecisionNumber; }
    public DivorceType getDivorceType() { return divorceType; }
    public void setDivorceType(DivorceType divorceType) { this.divorceType = divorceType; }
    public String getDivorceReason() { return divorceReason; }
    public void setDivorceReason(String divorceReason) { this.divorceReason = divorceReason; }
    public String getChildCustodyAgreement() { return childCustodyAgreement; }
    public void setChildCustodyAgreement(String childCustodyAgreement) { this.childCustodyAgreement = childCustodyAgreement; }
    public String getFinancialSettlement() { return financialSettlement; }
    public void setFinancialSettlement(String financialSettlement) { this.financialSettlement = financialSettlement; }
    public BigDecimal getSettlementAmount() { return settlementAmount; }
    public void setSettlementAmount(BigDecimal settlementAmount) { this.settlementAmount = settlementAmount; }
    public String getSettlementCurrency() { return settlementCurrency; }
    public void setSettlementCurrency(String settlementCurrency) { this.settlementCurrency = settlementCurrency; }
    public ReligiousAuthority getReligiousAuthority() { return religiousAuthority; }
    public void setReligiousAuthority(ReligiousAuthority religiousAuthority) { this.religiousAuthority = religiousAuthority; }
    public String getShariaCourtApproval() { return shariaCourtApproval; }
    public void setShariaCourtApproval(String shariaCourtApproval) { this.shariaCourtApproval = shariaCourtApproval; }
    public RecordStatus getStatus() { return status; }
    public void setStatus(RecordStatus status) { this.status = status; }
}
