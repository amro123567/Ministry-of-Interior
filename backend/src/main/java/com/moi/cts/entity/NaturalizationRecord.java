package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "naturalization_records")
public class NaturalizationRecord {

    @Id
    private Long documentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "document_id")
    private Document document;

    @Column(length = 60)
    private String previousNationality;

    private LocalDate naturalizationDate;

    @Column(length = 60)
    private String decreeNumber;

    private LocalDate decreeDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RecordStatus status = RecordStatus.ACTIVE;

    public Long getDocumentId() { return documentId; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public String getPreviousNationality() { return previousNationality; }
    public void setPreviousNationality(String previousNationality) { this.previousNationality = previousNationality; }
    public LocalDate getNaturalizationDate() { return naturalizationDate; }
    public void setNaturalizationDate(LocalDate naturalizationDate) { this.naturalizationDate = naturalizationDate; }
    public String getDecreeNumber() { return decreeNumber; }
    public void setDecreeNumber(String decreeNumber) { this.decreeNumber = decreeNumber; }
    public LocalDate getDecreeDate() { return decreeDate; }
    public void setDecreeDate(LocalDate decreeDate) { this.decreeDate = decreeDate; }
    public RecordStatus getStatus() { return status; }
    public void setStatus(RecordStatus status) { this.status = status; }
}
