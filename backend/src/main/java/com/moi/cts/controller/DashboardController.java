package com.moi.cts.controller;

import com.moi.cts.dto.MiscDtos.DashboardSummaryDto;
import com.moi.cts.service.CsvExportService;
import com.moi.cts.service.DashboardService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DashboardController {

    private final DashboardService dashboardService;
    private final CsvExportService csvExportService;

    public DashboardController(DashboardService dashboardService, CsvExportService csvExportService) {
        this.dashboardService = dashboardService;
        this.csvExportService = csvExportService;
    }

    @GetMapping("/api/dashboard/summary")
    public DashboardSummaryDto summary() { return dashboardService.summary(); }

    @GetMapping("/api/requests/export")
    public ResponseEntity<byte[]> exportCsv() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("correspondence_requests.csv").build().toString())
                .body(csvExportService.requestsCsv());
    }
}
