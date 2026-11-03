package com.moi.cts.service;

import com.moi.cts.dto.MiscDtos.AuditEntryDto;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.AuditLogEntry;
import com.moi.cts.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

import org.springframework.data.domain.Sort;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Locale;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(String entityType, Long entityId, String action, AppUser actor, String details) {
        AuditLogEntry entry = new AuditLogEntry();
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setAction(action);
        entry.setActor(actor);
        entry.setDetails(details);
        auditLogRepository.save(entry);
    }

    public List<AuditEntryDto> forEntity(String entityType, Long entityId) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByOccurredAtDesc(entityType, entityId)
                .stream().map(this::toDto).toList();
    }

    public List<AuditEntryDto> recent() {
        return auditLogRepository.findTop50ByOrderByOccurredAtDesc()
                .stream().map(this::toDto).toList();
    }

    /**
     * Filtered view of the whole audit log, newest first. Every filter is optional;
     * {@code q} matches the actor name, details, entity type or "Type #id" text.
     */
    public List<AuditEntryDto> search(String q, String entityType, String action,
                                      Instant from, Instant to, int limit) {
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        return auditLogRepository.findAll(Sort.by(Sort.Direction.DESC, "occurredAt", "id")).stream()
                .filter(e -> entityType == null || entityType.isBlank() || e.getEntityType().equals(entityType))
                .filter(e -> action == null || action.isBlank() || e.getAction().equals(action))
                .filter(e -> from == null || !e.getOccurredAt().isBefore(from))
                .filter(e -> to == null || e.getOccurredAt().isBefore(to))
                .filter(e -> needle.isEmpty() || haystack(e).contains(needle))
                .limit(limit)
                .map(this::toDto)
                .toList();
    }

    /** Distinct action and entity-type names, so the UI can offer every value, not just recent ones. */
    public AuditFacets facets() {
        List<AuditLogEntry> all = auditLogRepository.findAll();
        return new AuditFacets(
                all.stream().map(AuditLogEntry::getAction).distinct().sorted().toList(),
                all.stream().map(AuditLogEntry::getEntityType).distinct().sorted().toList());
    }

    public record AuditFacets(List<String> actions, List<String> entityTypes) {}

    public byte[] searchCsv(String q, String entityType, String action, Instant from, Instant to) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (PrintWriter writer = new PrintWriter(buffer, true, StandardCharsets.UTF_8)) {
            writer.println("Timestamp,Action,EntityType,EntityId,Actor,Details");
            for (AuditEntryDto e : search(q, entityType, action, from, to, 10_000)) {
                writer.println(String.join(",",
                        CsvCells.cell(e.occurredAt().toString()),
                        CsvCells.cell(e.action()),
                        CsvCells.cell(e.entityType()),
                        CsvCells.cell(String.valueOf(e.entityId())),
                        CsvCells.cell(e.actorName()),
                        CsvCells.cell(e.details())));
            }
        }
        return buffer.toByteArray();
    }

    private static String haystack(AuditLogEntry e) {
        return ((e.getActor() != null ? e.getActor().getFullName() : "system") + " "
                + (e.getDetails() == null ? "" : e.getDetails()) + " "
                + e.getEntityType() + " #" + e.getEntityId() + " " + e.getAction()).toLowerCase(Locale.ROOT);
    }

    private AuditEntryDto toDto(AuditLogEntry e) {
        return new AuditEntryDto(e.getId(), e.getEntityType(), e.getEntityId(), e.getAction(),
                e.getActor() != null ? e.getActor().getFullName() : "system", e.getDetails(), e.getOccurredAt());
    }
}
