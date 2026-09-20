package com.moi.cts.service;

import com.moi.cts.dto.MiscDtos.AgingBucketDto;
import com.moi.cts.dto.MiscDtos.DocumentTypeBreakdownDto;
import com.moi.cts.dto.MiscDtos.OfficeBreakdownDto;
import com.moi.cts.dto.MiscDtos.ReportsSummaryDto;
import com.moi.cts.dto.MiscDtos.ThroughputPointDto;
import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.DocumentType;
import com.moi.cts.entity.Office;
import com.moi.cts.entity.RequestStatus;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Read-only reporting/analytics queries over the existing correspondence
 * request data. Everything here is computed in-memory from
 * requestRepository.findAll(), the same pattern DashboardService already
 * uses -- this project's dataset is small enough that a dedicated
 * aggregation pipeline (materialized views, a separate reporting store)
 * would be over-engineering, and it keeps every number trivially
 * traceable back to the same source of truth the rest of the API uses.
 */
@Service
public class ReportsService {

    private static final int THROUGHPUT_WEEKS = 8;
    private static final DateTimeFormatter WEEK_LABEL_FMT = DateTimeFormatter.ofPattern("MMM d");

    private final CorrespondenceRequestRepository requestRepository;

    public ReportsService(CorrespondenceRequestRepository requestRepository) {
        this.requestRepository = requestRepository;
    }

    public ReportsSummaryDto summary() {
        List<CorrespondenceRequest> all = requestRepository.findAll();
        return new ReportsSummaryDto(
                throughput(all),
                aging(all),
                byDocumentType(all),
                byOffice(all),
                slaBreachRate(all));
    }

    /**
     * Rolling 7-day windows (not calendar weeks, to sidestep timezone edge
     * cases) covering the last {@value #THROUGHPUT_WEEKS} weeks, oldest
     * first. A request counts as "created" in the window containing its
     * createdAt, and "closed" in the window containing its closedAt.
     */
    private List<ThroughputPointDto> throughput(List<CorrespondenceRequest> all) {
        Instant now = Instant.now();
        List<ThroughputPointDto> points = new ArrayList<>();
        for (int weeksAgo = THROUGHPUT_WEEKS - 1; weeksAgo >= 0; weeksAgo--) {
            Instant windowStart = now.minus((long) (weeksAgo + 1) * 7, ChronoUnit.DAYS);
            Instant windowEnd = now.minus((long) weeksAgo * 7, ChronoUnit.DAYS);
            long created = all.stream()
                    .filter(r -> r.getCreatedAt() != null
                            && !r.getCreatedAt().isBefore(windowStart) && r.getCreatedAt().isBefore(windowEnd))
                    .count();
            long closed = all.stream()
                    .filter(r -> r.getClosedAt() != null
                            && !r.getClosedAt().isBefore(windowStart) && r.getClosedAt().isBefore(windowEnd))
                    .count();
            String label = LocalDate.ofInstant(windowStart, ZoneOffset.UTC).format(WEEK_LABEL_FMT);
            points.add(new ThroughputPointDto(label, created, closed));
        }
        return points;
    }

    /**
     * Age buckets for requests that are still open (not archived/rejected,
     * not yet closed) -- how long each has been sitting since it was
     * created.
     */
    private List<AgingBucketDto> aging(List<CorrespondenceRequest> all) {
        Instant now = Instant.now();
        Map<String, Long> buckets = new LinkedHashMap<>();
        buckets.put("0-2 days", 0L);
        buckets.put("3-5 days", 0L);
        buckets.put("6-10 days", 0L);
        buckets.put("11+ days", 0L);

        for (CorrespondenceRequest r : all) {
            boolean open = r.getClosedAt() == null
                    && r.getStatus() != RequestStatus.ARCHIVED && r.getStatus() != RequestStatus.REJECTED;
            if (!open || r.getCreatedAt() == null) continue;
            long ageDays = Duration.between(r.getCreatedAt(), now).toDays();
            String bucket = ageDays <= 2 ? "0-2 days" : ageDays <= 5 ? "3-5 days" : ageDays <= 10 ? "6-10 days" : "11+ days";
            buckets.merge(bucket, 1L, Long::sum);
        }
        return buckets.entrySet().stream().map(e -> new AgingBucketDto(e.getKey(), e.getValue())).toList();
    }

    private List<DocumentTypeBreakdownDto> byDocumentType(List<CorrespondenceRequest> all) {
        Map<DocumentType, List<CorrespondenceRequest>> grouped = all.stream()
                .collect(Collectors.groupingBy(CorrespondenceRequest::getDocumentType));
        return grouped.entrySet().stream()
                .map(e -> {
                    List<CorrespondenceRequest> closed = e.getValue().stream()
                            .filter(r -> r.getClosedAt() != null).toList();
                    double avgHours = closed.stream()
                            .mapToDouble(r -> Duration.between(r.getCreatedAt(), r.getClosedAt()).toMinutes() / 60.0)
                            .average().orElse(0.0);
                    return new DocumentTypeBreakdownDto(e.getKey().getNameEn(), e.getValue().size(),
                            Math.round(avgHours * 100.0) / 100.0);
                })
                .sorted(Comparator.comparing(DocumentTypeBreakdownDto::documentTypeName))
                .toList();
    }

    private List<OfficeBreakdownDto> byOffice(List<CorrespondenceRequest> all) {
        Map<Office, List<CorrespondenceRequest>> grouped = all.stream()
                .collect(Collectors.groupingBy(CorrespondenceRequest::getOffice));
        return grouped.entrySet().stream()
                .map(e -> {
                    long overdueCount = e.getValue().stream().filter(CorrespondenceRequest::isOverdue).count();
                    return new OfficeBreakdownDto(e.getKey().getNameEn(), e.getValue().size(), overdueCount);
                })
                .sorted(Comparator.comparing(OfficeBreakdownDto::officeName))
                .toList();
    }

    /**
     * Share of closed requests that were ever observed to be OVERDUE
     * (breachedAt set) before they closed. Requests closed before
     * breachedAt tracking existed (added earlier this round) will show as
     * not-breached even if they were actually late at the time -- an
     * honest limitation of adding the field going forward rather than
     * fabricating history that was never recorded.
     */
    private double slaBreachRate(List<CorrespondenceRequest> all) {
        List<CorrespondenceRequest> closed = all.stream().filter(r -> r.getClosedAt() != null).toList();
        if (closed.isEmpty()) return 0.0;
        long breached = closed.stream().filter(r -> r.getBreachedAt() != null).count();
        return Math.round(breached * 10000.0 / closed.size()) / 100.0;
    }
}
