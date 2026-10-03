package com.moi.cts.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

/**
 * One validator's sign-off on a {@link Document} (ERD {@code document_validations}).
 * A document can collect several validations over its life; every one is kept, so the
 * table is append-only like the other history tables. The document's current validation
 * state is simply its most recent row (or PENDING when there is none).
 */
@Immutable
@Entity
@Table(name = "document_validations")
public class DocumentValidation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id")
    private Document document;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "validator_id")
    private AppUser validator;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ValidationDecision decision;

    @Column(length = 500)
    private String comment;

    @Column(nullable = false, updatable = false)
    private Instant validatedAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public AppUser getValidator() { return validator; }
    public void setValidator(AppUser validator) { this.validator = validator; }
    public ValidationDecision getDecision() { return decision; }
    public void setDecision(ValidationDecision decision) { this.decision = decision; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public Instant getValidatedAt() { return validatedAt; }
    public void setValidatedAt(Instant validatedAt) { this.validatedAt = validatedAt; }
}
