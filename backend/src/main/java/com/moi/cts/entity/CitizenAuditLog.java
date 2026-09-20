package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * Tier 2 of the full-requirements migration punch list's Item 6
 * ("three-tier audit/access logging"): the ERD's {@code citizen_audit_log}
 * -- a field-level "who changed this person's data, from what, to what,
 * and why" trail, distinct from both the general action log
 * ({@link AuditLogEntry}, tier 1, unchanged by this item) and the
 * read-access trail ({@link RecordAccessLog}, tier 3, added alongside
 * this one).
 *
 * <p>Written from the three places in this codebase that actually mutate
 * a citizen's own fields after creation: {@code CitizenRegistryService}'s
 * amendment approval (linked via {@link #amendment}, carrying the
 * amendment's own legal basis as {@link #reason}) and registry-transfer
 * approval (office reassignment, {@link #amendment} left null), and
 * {@code CitizenService.updateLineage()} (father/mother corrections,
 * {@link #amendment} left null). Citizen *creation* is deliberately not
 * logged here -- there's no "old value" for a field that didn't exist a
 * moment ago, and it's already covered by tier 1's
 * {@code CITIZEN_CREATED} action.
 *
 * <p>The ERD's own FK for this table is {@code citizens.civil_registry_number}
 * (a varchar business key) rather than a surrogate id -- this project
 * follows its own established convention instead (every other FK to
 * {@code Citizen} in this codebase, e.g. on {@code FamilyMember} and
 * {@code RegistryTransfer}, points at the surrogate {@code id}), for the
 * same reason those did: one join column type across the whole domain,
 * not a special case for this one table.
 */
@Entity
@Table(name = "citizen_audit_log")
public class CitizenAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "citizen_id", nullable = false)
    private Citizen citizen;

    /** Set when this change came from an approved {@link CivilStatusAmendment}; null for lineage/transfer changes. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "amendment_id")
    private CivilStatusAmendment amendment;

    @Column(name = "field_name", nullable = false, length = 60)
    private String fieldName;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private AppUser changedBy;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt = Instant.now();

    @Column(length = 500)
    private String reason;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Citizen getCitizen() { return citizen; }
    public void setCitizen(Citizen citizen) { this.citizen = citizen; }
    public CivilStatusAmendment getAmendment() { return amendment; }
    public void setAmendment(CivilStatusAmendment amendment) { this.amendment = amendment; }
    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }
    public String getOldValue() { return oldValue; }
    public void setOldValue(String oldValue) { this.oldValue = oldValue; }
    public String getNewValue() { return newValue; }
    public void setNewValue(String newValue) { this.newValue = newValue; }
    public AppUser getChangedBy() { return changedBy; }
    public void setChangedBy(AppUser changedBy) { this.changedBy = changedBy; }
    public Instant getChangedAt() { return changedAt; }
    public void setChangedAt(Instant changedAt) { this.changedAt = changedAt; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
}
