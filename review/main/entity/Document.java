package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * The generic supertype for every certificate/record this system issues
 * (birth, marriage, divorce, death certificates; national ID cards;
 * naturalization/name-change records). Realizes the corrected ERD's
 * Class Table Inheritance pattern (Fowler): everything true of *every*
 * document lives here; each subtype ({@link BirthCertificate} etc.) adds
 * only what's true of that type, sharing this row's {@code id} as both
 * its own primary key and its foreign key back here.
 * <p>
 * Three columns present in the ERD are deliberately <b>not</b> carried
 * over, each a disclosed simplification rather than a silent omission:
 * <ul>
 *   <li>{@code file_data} (an in-database LONGBLOB) -- the SDD itself
 *   flags this as a critical defect (D-01): it directly contradicts the
 *   approved proposal's own storage strategy ("only file paths and
 *   metadata will be maintained in the database") and was never
 *   implemented for the same reason {@code attachments} (the existing
 *   correspondence-request file domain) never stored binaries in MySQL
 *   either. {@code digitalFilePath} + {@code fileHash} are kept, per the
 *   SDD's own recommendation (R-10).</li>
 *   <li>{@code physical_file_location} and the whole
 *   {@code physical_document_handling} chain-of-custody table -- out of
 *   this item's scope (Item 3 is the supertype/subtype split; physical
 *   custody tracking is a separate concern the punch list doesn't cover
 *   yet).</li>
 *   <li>{@code document_group_id} (a versioning chain shared across
 *   superseding rows) -- {@code version}/{@code isLatest} are kept for
 *   basic tracking, but the ERD's own "exactly one current version"
 *   guarantee needs a partial/filtered unique index
 *   (a {@code (document_group_id, is_latest)} unique index where
 *   {@code is_latest} is NULL for superseded rows) that standard JPA/
 *   Hibernate can't express portably. Left unenforced at the database
 *   level, same as the SDD's own D-05 finding.</li>
 * </ul>
 * {@code document_validations} (multi-validator sign-off) is also out of
 * scope here -- it belongs with the audit/access-logging item, not the
 * document supertype itself.
 */
@Entity
@Table(name = "documents")
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_type_id")
    private DocumentType documentType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "citizen_id")
    private Citizen citizen;

    @Column(unique = true, length = 60)
    private String documentNumber;

    private LocalDate issueDate;
    private LocalDate expiryDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issuing_office_id")
    private Office issuingOffice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attested_by_mukhtar_id")
    private Mukhtar attestedByMukhtar;

    @Column(length = 500)
    private String digitalFilePath;

    @Column(length = 64)
    private String fileHash;

    private Integer fileSize;

    @Column(length = 100)
    private String mimeType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentStatus status = DocumentStatus.DRAFT;

    @Column(nullable = false)
    private int version = 1;

    @Column(nullable = false)
    private boolean isLatest = true;

    @Column(nullable = false)
    private boolean isDeleted = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deleted_by")
    private AppUser deletedBy;

    private Instant deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private AppUser createdBy;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private AppUser updatedBy;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }
    public Citizen getCitizen() { return citizen; }
    public void setCitizen(Citizen citizen) { this.citizen = citizen; }
    public String getDocumentNumber() { return documentNumber; }
    public void setDocumentNumber(String documentNumber) { this.documentNumber = documentNumber; }
    public LocalDate getIssueDate() { return issueDate; }
    public void setIssueDate(LocalDate issueDate) { this.issueDate = issueDate; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public Office getIssuingOffice() { return issuingOffice; }
    public void setIssuingOffice(Office issuingOffice) { this.issuingOffice = issuingOffice; }
    public Mukhtar getAttestedByMukhtar() { return attestedByMukhtar; }
    public void setAttestedByMukhtar(Mukhtar attestedByMukhtar) { this.attestedByMukhtar = attestedByMukhtar; }
    public String getDigitalFilePath() { return digitalFilePath; }
    public void setDigitalFilePath(String digitalFilePath) { this.digitalFilePath = digitalFilePath; }
    public String getFileHash() { return fileHash; }
    public void setFileHash(String fileHash) { this.fileHash = fileHash; }
    public Integer getFileSize() { return fileSize; }
    public void setFileSize(Integer fileSize) { this.fileSize = fileSize; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public DocumentStatus getStatus() { return status; }
    public void setStatus(DocumentStatus status) { this.status = status; }
    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }
    public boolean isLatest() { return isLatest; }
    public void setLatest(boolean latest) { isLatest = latest; }
    public boolean isDeleted() { return isDeleted; }
    public void setDeleted(boolean deleted) { isDeleted = deleted; }
    public AppUser getDeletedBy() { return deletedBy; }
    public void setDeletedBy(AppUser deletedBy) { this.deletedBy = deletedBy; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public AppUser getCreatedBy() { return createdBy; }
    public void setCreatedBy(AppUser createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public AppUser getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(AppUser updatedBy) { this.updatedBy = updatedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
}
