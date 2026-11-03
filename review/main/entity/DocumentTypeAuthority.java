package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * Says that documents of one {@link DocumentType} may be authorised by one kind of body
 * (ERD {@code document_type_authorities}). A type with no rows here is unrestricted.
 */
@Entity
@Table(name = "document_type_authorities",
        uniqueConstraints = @UniqueConstraint(columnNames = {"document_type_id", "authority_kind"}))
public class DocumentTypeAuthority {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_type_id")
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "authority_kind", nullable = false, length = 30)
    private AuthorityKind authorityKind;

    public Long getId() { return id; }
    public DocumentType getDocumentType() { return documentType; }
    public void setDocumentType(DocumentType documentType) { this.documentType = documentType; }
    public AuthorityKind getAuthorityKind() { return authorityKind; }
    public void setAuthorityKind(AuthorityKind authorityKind) { this.authorityKind = authorityKind; }
}
