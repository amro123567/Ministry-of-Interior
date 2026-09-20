package com.moi.cts.controller;

import com.moi.cts.dto.MiscDtos.ReportsSummaryDto;
import com.moi.cts.service.ReportsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ReportsController {

    private final ReportsService reportsService;

    public ReportsController(ReportsService reportsService) {
        this.reportsService = reportsService;
    }

    @GetMapping("/api/reports/summary")
    public ReportsSummaryDto summary() {
        return reportsService.summary();
    }
}
