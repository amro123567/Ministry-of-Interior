package com.moi.cts.service;

import com.moi.cts.dto.CitizenAuditDtos.CitizenAuditLogDto;
import com.moi.cts.dto.CitizenAuditDtos.RecordAccessLogDto;
import com.moi.cts.entity.*;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.CitizenAuditLogRepository;
import com.moi.cts.repository.RecordAccessLogRepository;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Objects;

/**
 * Tiers 2 and 3 of Item 6's three-tier audit/access logging (see {@link
 * CitizenAuditLog} and {@link RecordAccessLog} for what each records and
 * why). Tier 1, the general action log ({@link AuditLogEntry} via {@link
 * AuditService}), is untouched by this item -- these two tiers are
 * genuinely new, not a rework of what already existed.
 *
 * <p>Kept as its own service, separate from {@link AuditService}, the
 * same way {@code RequestFinanceService} was kept separate from
 * {@code SlaController} in Item 5: the citizen-specific field/access
 * trail is a distinct domain from the generic entity action log, with
 * its own two tables, its own query shapes (by citizen, by actor), and
 * its own callers.
 */
@Service
public class CitizenAuditService {

    private final CitizenAuditLogRepository citizenAuditLogRepository;
    private final RecordAccessLogRepository recordAccessLogRepository;
    private final AppUserRepository userRepository;

    public CitizenAuditService(CitizenAuditLogRepository citizenAuditLogRepository,
                                RecordAccessLogRepository recordAccessLogRepository,
                                AppUserRepository userRepository) {
        this.citizenAuditLogRepository = citizenAuditLogRepository;
        this.recordAccessLogRepository = recordAccessLogRepository;
        this.userRepository = userRepository;
    }

    // ==== tier 2: field-level citizen change log ============================

    /**
     * Records one field-level change. A no-op if {@code oldValue} and
     * {@code newValue} are equal -- e.g. an amendment that "changes" a
     * field to the value it already had shouldn't produce a change row,
     * since nothing about the citizen's data actually changed.
     */
    @Transactional
    public void logFieldChange(Citizen citizen, CivilStatusAmendment amendment, String fieldName, String oldValue,
                                String newValue, AppUser changedBy, String reason) {
        if (Objects.equals(oldValue, newValue)) return;
        CitizenAuditLog log = new CitizenAuditLog();
        log.setCitizen(citizen);
        log.setAmendment(amendment);
        log.setFieldName(fieldName);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        log.setChangedBy(changedBy);
        log.setReason(reason);
        log.setIpAddress(currentIpAddress());
        citizenAuditLogRepository.save(log);
    }

    public List<CitizenAuditLogDto> changeHistoryForCitizen(Long citizenId) {
        return citizenAuditLogRepository.findByCitizenIdOrderByChangedAtDesc(citizenId).stream()
                .map(this::toDto).toList();
    }

    // ==== tier 3: record access log ==========================================

    @Transactional
    public void logAccess(Citizen citizen, AppUserPrincipal actor, AccessType accessType, String reason) {
        RecordAccessLog log = new RecordAccessLog();
        log.setCitizen(citizen);
        log.setAccessedBy(currentUser(actor));
        log.setAccessType(accessType);
        log.setReason(reason);
        log.setIpAddress(currentIpAddress());
        recordAccessLogRepository.save(log);
    }

    public List<RecordAccessLogDto> accessHistoryForCitizen(Long citizenId) {
        return recordAccessLogRepository.findByCitizenIdOrderByAccessedAtDesc(citizenId).stream()
                .map(this::toDto).toList();
    }

    /** "What has this employee been looking at" -- the SDD's own stated reason record_access_log indexes accessed_by. */
    public List<RecordAccessLogDto> accessHistoryByUser(Long userId) {
        return recordAccessLogRepository.findByAccessedByIdOrderByAccessedAtDesc(userId).stream()
                .map(this::toDto).toList();
    }

    // ==== helpers ============================================================

    private AppUser currentUser(AppUserPrincipal actor) {
        if (actor == null) return null;
        return userRepository.findById(actor.getId()).orElse(null);
    }

    /**
     * Best-effort caller IP via Spring's request-scoped attributes --
     * available because this always runs on the same thread as the
     * controller method that's still handling the HTTP request. Returns
     * null outside a request (e.g. if ever called from DataSeeder or a
     * scheduled job) rather than throwing.
     */
    private String currentIpAddress() {
        try {
            var attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes servletAttrs) {
                return servletAttrs.getRequest().getRemoteAddr();
            }
        } catch (IllegalStateException ignored) {
            // no request bound to this thread
        }
        return null;
    }

    private CitizenAuditLogDto toDto(CitizenAuditLog l) {
        return new CitizenAuditLogDto(l.getId(), l.getCitizen().getId(), l.getCitizen().getRegistryNumber(),
                l.getAmendment() != null ? l.getAmendment().getId() : null, l.getFieldName(), l.getOldValue(),
                l.getNewValue(), l.getChangedBy() != null ? l.getChangedBy().getId() : null,
                l.getChangedBy() != null ? l.getChangedBy().getFullName() : null, l.getChangedAt(), l.getReason(),
                l.getIpAddress());
    }

    private RecordAccessLogDto toDto(RecordAccessLog l) {
        return new RecordAccessLogDto(l.getId(), l.getCitizen().getId(), l.getCitizen().getRegistryNumber(),
                l.getAccessedBy() != null ? l.getAccessedBy().getId() : null,
                l.getAccessedBy() != null ? l.getAccessedBy().getFullName() : null, l.getAccessType().name(),
                l.getAccessedAt(), l.getReason(), l.getIpAddress());
    }
}
