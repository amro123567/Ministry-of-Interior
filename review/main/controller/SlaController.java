package com.moi.cts.controller;

import com.moi.cts.dto.RequestDtos.RequestSummaryDto;
import com.moi.cts.entity.SlaStatus;
import com.moi.cts.service.RequestService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * SLA-status list views. SLA status is a live-computed property on
 * CorrespondenceRequest (see CorrespondenceRequest.getSlaStatus()), not a
 * separate table kept in sync by a scheduled job -- these endpoints just
 * expose that computed property pre-filtered, which is what the 20-day
 * plan's GET /api/sla/overdue and GET /api/sla/due-soon endpoints were
 * meant to provide.
 */
@RestController
public class SlaController {

    private final RequestService requestService;

    public SlaController(RequestService requestService) {
        this.requestService = requestService;
    }

    @GetMapping("/api/sla/overdue")
    public List<RequestSummaryDto> overdue() {
        return requestService.listBySlaStatus(SlaStatus.OVERDUE);
    }

    @GetMapping("/api/sla/due-soon")
    public List<RequestSummaryDto> dueSoon() {
        return requestService.listBySlaStatus(SlaStatus.DUE_SOON);
    }
}
