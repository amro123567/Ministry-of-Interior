package com.moi.cts.service;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.dto.RequestDtos.RequestFilter;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;

@Service
public class CsvExportService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ISO_INSTANT;

    private final RequestService requestService;

    public CsvExportService(RequestService requestService) {
        this.requestService = requestService;
    }

    /** Exports exactly the rows the list endpoint would return for the same filter. */
    public byte[] requestsCsv(RequestFilter filter, Long actorUserId) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(buffer, true, StandardCharsets.UTF_8)) {
            writer.println("Reference,Citizen,RegistryNumber,DocumentType,Office,Status,Priority,"
                    + "AssignedTo,CreatedAt,DueAt,ClosedAt,Overdue,Direction,Subject,Department");
            for (CorrespondenceRequest r : requestService.findMatching(filter, actorUserId)) {
                writer.println(String.join(",",
                        csv(r.getReferenceNumber()),
                        csv(r.getCitizen().getFirstNameEn() + " " + nullToEmpty(r.getCitizen().getLastNameEn())),
                        csv(r.getCitizen().getRegistryNumber()),
                        csv(r.getDocumentType().getNameEn()),
                        csv(r.getOffice().getNameEn()),
                        csv(r.getStatus().name()),
                        csv(r.getPriority()),
                        csv(r.getAssignedTo() != null ? r.getAssignedTo().getFullName() : ""),
                        csv(r.getCreatedAt() != null ? FMT.format(r.getCreatedAt()) : ""),
                        csv(r.getDueAt() != null ? FMT.format(r.getDueAt()) : ""),
                        csv(r.getClosedAt() != null ? FMT.format(r.getClosedAt()) : ""),
                        csv(String.valueOf(r.isOverdue())),
                        csv(r.getDirection() != null ? r.getDirection().name() : ""),
                        csv(r.getSubject()),
                        csv(r.getDepartment() != null ? r.getDepartment().getNameEn() : "")));
            }
        }
        return buffer.toByteArray();
    }

    private String csv(String value) {
        String v = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + v + "\"";
    }

    private String nullToEmpty(String s) { return s == null ? "" : s; }
}
