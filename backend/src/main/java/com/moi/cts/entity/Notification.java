package com.moi.cts.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_id")
    private AppUser recipient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id")
    private CorrespondenceRequest relatedRequest;

    @Column(nullable = false, length = 300)
    private String message;

    @Column(nullable = false)
    private boolean readFlag = false;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public AppUser getRecipient() { return recipient; }
    public void setRecipient(AppUser recipient) { this.recipient = recipient; }
    public CorrespondenceRequest getRelatedRequest() { return relatedRequest; }
    public void setRelatedRequest(CorrespondenceRequest relatedRequest) { this.relatedRequest = relatedRequest; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public boolean isReadFlag() { return readFlag; }
    public void setReadFlag(boolean readFlag) { this.readFlag = readFlag; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
