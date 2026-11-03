package com.moi.cts.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A fee payment (or waiver) recorded against a {@link CorrespondenceRequest}
 * (ERD domain 7, {@code payments}) -- full-requirements migration punch
 * list Item 5. {@code collectedBy} is nullable because a {@code WAIVED}
 * payment has no collector; every other field the ERD marks as an FK is
 * required, matching the ERD's own column list exactly (this table has no
 * disclosed simplifications, unlike most of the entities added this
 * migration -- it maps cleanly onto the existing request/user model with
 * nothing to drop or defer).
 */
@Entity
@Table(name = "payments", uniqueConstraints = @UniqueConstraint(columnNames = "receipt_number"))
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "correspondence_request_id")
    private CorrespondenceRequest request;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentMethod method;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PaymentStatus status;

    @Column(name = "receipt_number", length = 40)
    private String receiptNumber;

    @ManyToOne(fetch = FetchType.EAGER, optional = true)
    @JoinColumn(name = "collected_by")
    private AppUser collectedBy;

    @Column(name = "paid_at", nullable = false)
    private Instant paidAt;

    @ManyToOne(fetch = FetchType.EAGER, optional = true)
    @JoinColumn(name = "reversed_by")
    private AppUser reversedBy;

    @Column(name = "reversed_at")
    private Instant reversedAt;

    @Column(name = "reversal_reason", length = 255)
    private String reversalReason;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public CorrespondenceRequest getRequest() { return request; }
    public void setRequest(CorrespondenceRequest request) { this.request = request; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public PaymentMethod getMethod() { return method; }
    public void setMethod(PaymentMethod method) { this.method = method; }
    public PaymentStatus getStatus() { return status; }
    public void setStatus(PaymentStatus status) { this.status = status; }
    public String getReceiptNumber() { return receiptNumber; }
    public void setReceiptNumber(String receiptNumber) { this.receiptNumber = receiptNumber; }
    public AppUser getCollectedBy() { return collectedBy; }
    public void setCollectedBy(AppUser collectedBy) { this.collectedBy = collectedBy; }
    public Instant getPaidAt() { return paidAt; }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
    public AppUser getReversedBy() { return reversedBy; }
    public void setReversedBy(AppUser reversedBy) { this.reversedBy = reversedBy; }
    public Instant getReversedAt() { return reversedAt; }
    public void setReversedAt(Instant reversedAt) { this.reversedAt = reversedAt; }
    public String getReversalReason() { return reversalReason; }
    public void setReversalReason(String reversalReason) { this.reversalReason = reversalReason; }
}
