package com.moi.cts.controller;

import com.moi.cts.dto.MiscDtos.DashboardSummaryDto;
import com.moi.cts.dto.RequestDtos.RequestFilter;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.CsvExportService;
import com.moi.cts.service.DashboardService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

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
    public ResponseEntity<byte[]> exportCsv(@RequestParam(required = false) String status,
                                            @RequestParam(required = false) String search,
                                            @RequestParam(required = false) Boolean assignedToMe,
                                            @RequestParam(required = false) Long officeId,
                                            @RequestParam(required = false) String priority,
                                            @RequestParam(required = false) String direction,
                                            @RequestParam(required = false) String sla,
                                            @RequestParam(required = false)
                                            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                            @RequestParam(required = false)
                                            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                            @AuthenticationPrincipal AppUserPrincipal actor) {
        RequestFilter filter = new RequestFilter(status, search, assignedToMe, officeId,
                priority, direction, sla, from, to);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("correspondence_requests.csv").build().toString())
                .body(csvExportService.requestsCsv(filter, actor != null ? actor.getId() : null));
    }
}
