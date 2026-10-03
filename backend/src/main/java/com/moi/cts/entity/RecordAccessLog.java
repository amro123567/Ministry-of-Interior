package com.moi.cts.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

/**
 * Tier 3 of Item 6's three-tier audit/access logging: the ERD's
 * {@code record_access_log} -- who *read* a citizen record, not just who
 * changed one. Per the SDD's own defence of this table (13.3): in a
 * national registry the realistic threat is an insider looking up
 * someone they have no legitimate reason to look up, and that's
 * indistinguishable from legitimate work unless every read is recorded.
 *
 * <p>Written from {@code CitizenController.get()} ({@link
 * AccessType#VIEW_RECORD}, one row) and {@code CitizenController.search()}
 * ({@link AccessType#SEARCH_RESULT}, one row per citizen returned --
 * exactly the SDD's own stated trade-off that this becomes the largest,
 * fastest-growing table in the system, accepted here at the same scope
 * the SDD accepted it).
 *
 * <p><strong>Disclosed simplification</strong>: the ERD's own design
 * language (SDD 13.3, "reason records a stated justification, not merely
 * the fact of access") implies {@code reason} should be a *required*
 * justification the caller must supply before a read is even allowed.
 * This item does not make it required -- the existing citizen-search and
 * citizen-detail screens don't collect one, and turning a previously
 * unrestricted read into one that's rejected without a reason would be a
 * breaking frontend change with no coordinated UI update to go with it.
 * {@code reason} is accepted as an optional query parameter, stored
 * whenever the caller does supply one, and the read itself is still
 * logged (with a null reason) either way -- the honest middle ground
 * between "log nothing" and "silently block reads" for a capability
 * whose enforcement half is genuinely future work.
 */
@Immutable
@Entity
@Table(name = "record_access_log")
public class RecordAccessLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "citizen_id", nullable = false)
    private Citizen citizen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accessed_by")
    private AppUser accessedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_type", nullable = false, length = 20)
    private AccessType accessType;

    @Column(name = "accessed_at", nullable = false, updatable = false)
    private Instant accessedAt = Instant.now();

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(length = 500)
    private String reason;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Citizen getCitizen() { return citizen; }
    public void setCitizen(Citizen citizen) { this.citizen = citizen; }
    public AppUser getAccessedBy() { return accessedBy; }
    public void setAccessedBy(AppUser accessedBy) { this.accessedBy = accessedBy; }
    public AccessType getAccessType() { return accessType; }
    public void setAccessType(AccessType accessType) { this.accessType = accessType; }
    public Instant getAccessedAt() { return accessedAt; }
    public void setAccessedAt(Instant accessedAt) { this.accessedAt = accessedAt; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
