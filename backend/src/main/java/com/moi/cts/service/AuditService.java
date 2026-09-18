package com.moi.cts.service;

import com.moi.cts.dto.MiscDtos.AuditEntryDto;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.AuditLogEntry;
import com.moi.cts.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

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

    private AuditEntryDto toDto(AuditLogEntry e) {
        return new AuditEntryDto(e.getId(), e.getEntityType(), e.getEntityId(), e.getAction(),
                e.getActor() != null ? e.getActor().getFullName() : "system", e.getDetails(), e.getOccurredAt());
    }
}
