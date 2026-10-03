package com.moi.cts.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

/**
 * One chain-of-custody event for the paper original of a {@link Document}
 * (ERD {@code physical_document_handling}). The handler's name and role are copied onto
 * the row (snapshot) so the record stays true even if the user is later renamed or
 * changes role. Append-only.
 */
@Immutable
@Entity
@Table(name = "physical_document_handling")
public class PhysicalDocumentHandling {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "document_id")
    private Document document;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CustodyEventType eventType;

    @Column(nullable = false, length = 200)
    private String location;

    @Column(length = 500)
    private String note;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "handled_by_id")
    private AppUser handledBy;

    @Column(nullable = false, length = 150)
    private String handledByNameSnapshot;

    @Column(nullable = false, length = 100)
    private String handledByRoleSnapshot;

    @Column(nullable = false, updatable = false)
    private Instant handledAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Document getDocument() { return document; }
    public void setDocument(Document document) { this.document = document; }
    public CustodyEventType getEventType() { return eventType; }
    public void setEventType(CustodyEventType eventType) { this.eventType = eventType; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public AppUser getHandledBy() { return handledBy; }
    public void setHandledBy(AppUser handledBy) { this.handledBy = handledBy; }
    public String getHandledByNameSnapshot() { return handledByNameSnapshot; }
    public void setHandledByNameSnapshot(String s) { this.handledByNameSnapshot = s; }
    public String getHandledByRoleSnapshot() { return handledByRoleSnapshot; }
    public void setHandledByRoleSnapshot(String s) { this.handledByRoleSnapshot = s; }
    public Instant getHandledAt() { return handledAt; }
    public void setHandledAt(Instant handledAt) { this.handledAt = handledAt; }
}
