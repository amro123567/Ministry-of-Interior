package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Shared base for the reference & organizational hierarchy domain
 * (governorates, districts, departments, courts, religious authorities,
 * mukhtars -- see FULL_DATABASE_MIGRATION_ANALYSIS.md domain 1). The
 * design docs' own rule for this domain -- "reference entities are
 * deactivated, never deleted, because a closed office still owns
 * historical records" -- lives here once instead of being copy-pasted
 * onto every one of these entities. {@code office}, {@code documentType},
 * and {@code role} predate this base and are intentionally left as-is:
 * retrofitting it onto entities with existing rows/behavior is a separate,
 * riskier change than giving it to the brand-new tables in this item.
 */
@MappedSuperclass
public abstract class ReferenceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
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
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
