package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.LocalDate;

/**
 * The ERD links this to {@code civil_status_amendments} via
 * {@code amendment_id} -- the SDD flags this as the "third" mechanism
 * that can record the same name-change fact (alongside this table and
 * {@code citizen_audit_log}), with nothing coordinating them. Rather than
 * leave that gap unaddressed, this keeps the FK so a name-change
 * certificate can be traced back to the {@link CivilStatusAmendment} that
 * legally authorised it (Item 2), but the link is nullable and optional:
 * a certificate can also be issued for a name change with no
 * amendment on file (e.g. one predating this system).
 */
@Entity
@Table(name = "name_change_records")
public class NameChangeRecord {

    @Id
    private Long documentId;

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId
    @JoinColumn(name = "document_id")
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "amendment_id")
    private CivilStatusAmendment amendment;

    @Column(length = 80)
    private String oldFirstName;

    @Column(length = 80)
    private String oldMiddleName;

    @Column(length = 80)
    private String oldLastName;

    @Column(length = 80)
    private String newFirstName;

    @Column(length = 80)
    private String newMiddleName;

    @Column(length = 80)
    private String newLastName;

    @Lob
    private String reason;

    @Column(length = 60)
    private String courtDecisionNumber;

    private LocalDate changeDate;

    public Long getDocumentId() { return documentId; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public CivilStatusAmendment getAmendment() { return amendment; }
    public void setAmendment(CivilStatusAmendment amendment) { this.amendment = amendment; }
    public String getOldFirstName() { return oldFirstName; }
    public void setOldFirstName(String oldFirstName) { this.oldFirstName = oldFirstName; }
    public String getOldMiddleName() { return oldMiddleName; }
    public void setOldMiddleName(String oldMiddleName) { this.oldMiddleName = oldMiddleName; }
    public String getOldLastName() { return oldLastName; }
    public void setOldLastName(String oldLastName) { this.oldLastName = oldLastName; }
    public String getNewFirstName() { return newFirstName; }
    public void setNewFirstName(String newFirstName) { this.newFirstName = newFirstName; }
    public String getNewMiddleName() { return newMiddleName; }
    public void setNewMiddleName(String newMiddleName) { this.newMiddleName = newMiddleName; }
    public String getNewLastName() { return newLastName; }
    public void setNewLastName(String newLastName) { this.newLastName = newLastName; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getCourtDecisionNumber() { return courtDecisionNumber; }
    public void setCourtDecisionNumber(String courtDecisionNumber) { this.courtDecisionNumber = courtDecisionNumber; }
    public LocalDate getChangeDate() { return changeDate; }
    public void setChangeDate(LocalDate changeDate) { this.changeDate = changeDate; }
}
