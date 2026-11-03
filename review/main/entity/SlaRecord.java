package com.moi.cts.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;

/**
 * A persisted, queryable SLA snapshot for one {@link CorrespondenceRequest}
 * (ERD domain 7, {@code sla_records}) -- full-requirements migration
 * punch list Item 5.
 *
 * <p>This deliberately <strong>coexists with, rather than replaces</strong>,
 * {@code CorrespondenceRequest.getSlaStatus()} and the reasoning in
 * {@code SlaNotificationScheduler}'s own Javadoc for why SLA status was
 * originally kept live-computed only ("never needs a background job to
 * stay correct"). That reasoning is still correct for an *open* request's
 * current risk -- {@code SlaController}, {@code DashboardService}, and the
 * scheduler all keep reading the live value, untouched by this item. What
 * the live computation structurally cannot give is exactly what the
 * migration-analysis document flagged as missing: a row that can be
 * queried/listed/filtered without recomputing over every request, a
 * historical snapshot of what SLA state a request was in as of a specific
 * check, and a genuine {@code MET}/{@code BREACHED} *outcome* recorded
 * once a request closes (the live method only ever describes an open
 * request's risk, never a closed one's outcome). {@link SlaRecord} is
 * always <em>derived from</em> the live computation by {@code
 * SlaRecordService.refresh(...)} -- it is a cache with one writer, not a
 * second source of truth that could drift, addressing exactly the
 * "duplicated fee/status" drift risk the SDD itself criticizes elsewhere
 * in this schema (D-21).
 */
@Entity
@Table(name = "sla_records", uniqueConstraints = @UniqueConstraint(columnNames = "correspondence_request_id"))
public class SlaRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "correspondence_request_id")
    private CorrespondenceRequest request;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "sla_status", nullable = false, length = 20)
    private SlaStatus slaStatus;

    @Column(name = "days_remaining")
    private Integer daysRemaining;

    @Column(name = "overdue_by_days")
    private Integer overdueByDays;

    @Column(name = "breached_at")
    private Instant breachedAt;

    @Column(name = "last_checked_at", nullable = false)
    private Instant lastCheckedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public CorrespondenceRequest getRequest() { return request; }
    public void setRequest(CorrespondenceRequest request) { this.request = request; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public SlaStatus getSlaStatus() { return slaStatus; }
    public void setSlaStatus(SlaStatus slaStatus) { this.slaStatus = slaStatus; }
    public Integer getDaysRemaining() { return daysRemaining; }
    public void setDaysRemaining(Integer daysRemaining) { this.daysRemaining = daysRemaining; }
    public Integer getOverdueByDays() { return overdueByDays; }
    public void setOverdueByDays(Integer overdueByDays) { this.overdueByDays = overdueByDays; }
    public Instant getBreachedAt() { return breachedAt; }
    public void setBreachedAt(Instant breachedAt) { this.breachedAt = breachedAt; }
    public Instant getLastCheckedAt() { return lastCheckedAt; }
    public void setLastCheckedAt(Instant lastCheckedAt) { this.lastCheckedAt = lastCheckedAt; }
}
