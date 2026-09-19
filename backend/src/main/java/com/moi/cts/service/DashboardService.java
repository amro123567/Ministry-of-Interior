package com.moi.cts.service;

import com.moi.cts.dto.MiscDtos.DashboardSummaryDto;
import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.RequestStatus;
import com.moi.cts.entity.SlaStatus;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class DashboardService {

    private final CorrespondenceRequestRepository requestRepository;

    public DashboardService(CorrespondenceRequestRepository requestRepository) {
        this.requestRepository = requestRepository;
    }

    public DashboardSummaryDto summary() {
        List<CorrespondenceRequest> all = requestRepository.findAll();

        Map<String, Long> byStatus = new LinkedHashMap<>();
        for (RequestStatus s : RequestStatus.values()) {
            byStatus.put(s.name(), all.stream().filter(r -> r.getStatus() == s).count());
        }

        // Delegates to the same computed SlaStatus the API and CSV export
        // use, instead of a second, separately-maintained overdue/due-soon
        // calculation -- one definition of "at risk", used everywhere.
        long overdue = all.stream().filter(r -> r.getSlaStatus() == SlaStatus.OVERDUE).count();
        long dueSoon = all.stream().filter(r -> r.getSlaStatus() == SlaStatus.DUE_SOON).count();

        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);
        List<CorrespondenceRequest> closedThisWeek = all.stream()
                .filter(r -> r.getClosedAt() != null && r.getClosedAt().isAfter(weekAgo)).toList();

        double avgHours = closedThisWeek.stream()
                .mapToDouble(r -> Duration.between(r.getCreatedAt(), r.getClosedAt()).toMinutes() / 60.0)
                .average().orElse(0.0);

        return new DashboardSummaryDto(all.size(), byStatus, overdue, dueSoon, closedThisWeek.size(),
                Math.round(avgHours * 100.0) / 100.0);
    }
}
