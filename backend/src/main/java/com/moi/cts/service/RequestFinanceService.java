package com.moi.cts.service;

import com.moi.cts.dto.RequestFinanceDtos.*;
import com.moi.cts.entity.*;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.repository.PaymentRepository;
import com.moi.cts.repository.SlaRecordRepository;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * The rest of ERD domain 7 ("Service requests / workflow") beyond what
 * earlier items already cover: a persisted, queryable {@link SlaRecord}
 * snapshot per request (see that entity's own Javadoc for why this
 * coexists with, rather than replaces, the live {@code getSlaStatus()}
 * this project deliberately chose earlier), and {@link Payment} records
 * against a request.
 *
 * <p><strong>Request assignments were deliberately left out of this
 * item</strong> -- disclosed, not an oversight. The ERD's
 * {@code request_assignments} table models "current assignee + full
 * history" as one table with an {@code is_active} flag and a
 * {@code UNIQUE(service_request_id, is_active)} constraint meant to
 * enforce "at most one active assignment" -- and the SDD's own critique
 * (D-11) flags that exact constraint as unenforceable as designed
 * ("MySQL cannot express a partial unique index... nothing prevents two
 * active assignments"). This project's existing design --
 * {@code CorrespondenceRequest.assignedToId} (a single column, so it is
 * *structurally* impossible to have two active assignments) plus the
 * already-built, already-tested {@code RequestAssignmentHistory} table
 * (immutable rows preserving every past assignment) -- already delivers
 * both halves of the requirement ("a queryable current assignee" and "a
 * preserved history") without the ERD's own flagged defect. Adding a
 * second, parallel assignment table here would duplicate working code to
 * satisfy an ERD shape that is arguably worse than what already exists,
 * so this item spends its effort on the two pieces that are genuinely
 * new instead.
 */
@Service
public class RequestFinanceService {

    private final SlaRecordRepository slaRecordRepository;
    private final PaymentRepository paymentRepository;
    private final CorrespondenceRequestRepository requestRepository;
    private final AppUserRepository userRepository;

    public RequestFinanceService(SlaRecordRepository slaRecordRepository, PaymentRepository paymentRepository,
                                  CorrespondenceRequestRepository requestRepository,
                                  AppUserRepository userRepository) {
        this.slaRecordRepository = slaRecordRepository;
        this.paymentRepository = paymentRepository;
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
    }

    // ==== SLA records ========================================================

    @Transactional
    public SlaRecordDto refreshSlaRecord(Long requestId) {
        CorrespondenceRequest request = findRequest(requestId);
        SlaRecord record = slaRecordRepository.findByRequestId(requestId).orElseGet(() -> {
            SlaRecord r = new SlaRecord();
            r.setRequest(request);
            return r;
        });

        Instant now = Instant.now();
        record.setDueDate(request.getDueAt() == null ? null
                : request.getDueAt().atZone(ZoneOffset.UTC).toLocalDate());
        record.setBreachedAt(request.getBreachedAt());
        record.setLastCheckedAt(now);

        boolean closed = request.getClosedAt() != null;
        if (closed) {
            boolean metOnTime = request.getDueAt() == null || !request.getClosedAt().isAfter(request.getDueAt());
            record.setSlaStatus(metOnTime ? SlaStatus.MET : SlaStatus.BREACHED);
            record.setDaysRemaining(null);
            record.setOverdueByDays(metOnTime ? null
                    : (int) ChronoUnit.DAYS.between(request.getDueAt(), request.getClosedAt()));
        } else {
            SlaStatus live = request.getSlaStatus();
            record.setSlaStatus(live);
            if (request.getDueAt() == null) {
                record.setDaysRemaining(null);
                record.setOverdueByDays(null);
            } else if (live == SlaStatus.OVERDUE) {
                record.setDaysRemaining(null);
                record.setOverdueByDays((int) Math.max(0, ChronoUnit.DAYS.between(request.getDueAt(), now)));
            } else {
                record.setDaysRemaining((int) Math.max(0, ChronoUnit.DAYS.between(now, request.getDueAt())));
                record.setOverdueByDays(null);
            }
        }

        return toDto(slaRecordRepository.save(record));
    }

    public SlaRecordDto getSlaRecord(Long requestId) {
        // Lazily create/refresh on first read rather than requiring every
        // caller to remember to POST /refresh first -- the snapshot is
        // cheap to (re)compute and always derived, never hand-edited.
        return refreshSlaRecord(requestId);
    }

    public List<SlaRecordDto> listSlaRecordsByStatus(SlaStatus status) {
        return slaRecordRepository.findBySlaStatus(status).stream().map(this::toDto).toList();
    }

    /** Used by {@code SlaNotificationScheduler}'s daily sweep. */
    @Transactional
    public void refreshAll() {
        for (CorrespondenceRequest r : requestRepository.findAll()) {
            if (r.getDueAt() == null) continue;
            refreshSlaRecord(r.getId());
        }
    }

    // ==== payments ============================================================

    @Transactional
    public PaymentDto recordPayment(RecordPaymentRequest request, AppUserPrincipal actor) {
        CorrespondenceRequest correspondenceRequest = findRequest(request.requestId());
        PaymentMethod method = parseMethod(request.method());

        if (request.receiptNumber() != null && !request.receiptNumber().isBlank()
                && paymentRepository.findByReceiptNumber(request.receiptNumber()).isPresent()) {
            throw new BadRequestException("Receipt number '" + request.receiptNumber() + "' is already in use.");
        }

        Payment payment = new Payment();
        payment.setRequest(correspondenceRequest);
        payment.setAmount(request.amount());
        payment.setCurrency(request.currency());
        payment.setMethod(method);
        payment.setStatus(PaymentStatus.PAID);
        payment.setReceiptNumber(request.receiptNumber());
        payment.setCollectedBy(method == PaymentMethod.WAIVED ? null : currentUser(actor));
        payment.setPaidAt(Instant.now());
        return toDto(paymentRepository.save(payment));
    }

    @Transactional
    public PaymentDto reversePayment(Long paymentId, ReversePaymentRequest request, AppUserPrincipal actor) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new NotFoundException("Payment not found: " + paymentId));
        if (payment.getStatus() == PaymentStatus.REVERSED) {
            throw new BadRequestException("Payment " + paymentId + " has already been reversed.");
        }
        payment.setStatus(PaymentStatus.REVERSED);
        payment.setReversedBy(currentUser(actor));
        payment.setReversedAt(Instant.now());
        payment.setReversalReason(request.reversalReason());
        return toDto(paymentRepository.save(payment));
    }

    public List<PaymentDto> paymentsForRequest(Long requestId) {
        return paymentRepository.findByRequestId(requestId).stream().map(this::toDto).toList();
    }

    // ==== helpers ============================================================

    private PaymentMethod parseMethod(String raw) {
        try {
            return PaymentMethod.valueOf(raw.toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown payment method: " + raw);
        }
    }

    private CorrespondenceRequest findRequest(Long id) {
        return requestRepository.findById(id).orElseThrow(() -> new NotFoundException("Request not found: " + id));
    }

    private AppUser currentUser(AppUserPrincipal actor) {
        if (actor == null) return null;
        return userRepository.findById(actor.getId()).orElse(null);
    }

    private SlaRecordDto toDto(SlaRecord r) {
        return new SlaRecordDto(r.getId(), r.getRequest().getId(), r.getRequest().getReferenceNumber(),
                r.getDueDate(), r.getSlaStatus().name(), r.getDaysRemaining(), r.getOverdueByDays(),
                r.getBreachedAt(), r.getLastCheckedAt());
    }

    private PaymentDto toDto(Payment p) {
        return new PaymentDto(p.getId(), p.getRequest().getId(), p.getRequest().getReferenceNumber(), p.getAmount(),
                p.getCurrency(), p.getMethod().name(), p.getStatus().name(), p.getReceiptNumber(),
                p.getCollectedBy() == null ? null : p.getCollectedBy().getId(),
                p.getCollectedBy() == null ? null : p.getCollectedBy().getFullName(), p.getPaidAt(),
                p.getReversedBy() == null ? null : p.getReversedBy().getId(),
                p.getReversedBy() == null ? null : p.getReversedBy().getFullName(), p.getReversedAt(),
                p.getReversalReason());
    }
}
