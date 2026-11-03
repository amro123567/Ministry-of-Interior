package com.moi.cts.aop;

import com.moi.cts.audit.Audited;
import com.moi.cts.entity.AppUser;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.AuditService;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

/**
 * Automatic audit logging for controller actions that didn't already have
 * one. RequestService's create/assign/transition, AttachmentService's
 * upload, and AuthService's login (and now logout) already call
 * AuditService.log(...) directly with a richer, hand-composed "details"
 * string (e.g. "DRAFT -> SUBMITTED", "assignedTo=officer") that a generic
 * reflection-based aspect can't reproduce as legibly -- those are
 * deliberately left un-annotated here rather than double-logged.
 *
 * Everything this aspect actually covers had NO audit entry at all
 * before: citizen registration, user account creation, document
 * downloads, and marking a notification read. Annotating those four
 * controller methods with @Audited closes that gap without touching
 * their service logic -- which is the actual point of doing this with
 * AOP instead of by hand, per the original plan: the audit behavior is
 * declared once at the call site, a future fifth method just needs the
 * annotation, and it's structurally impossible to add a new mutating
 * endpoint and simply forget to log it.
 */
@Aspect
@Component
public class AuditLoggingAspect {

    private final AuditService auditService;
    private final AppUserRepository userRepository;

    public AuditLoggingAspect(AuditService auditService, AppUserRepository userRepository) {
        this.auditService = auditService;
        this.userRepository = userRepository;
    }

    @AfterReturning(pointcut = "@annotation(audited)", returning = "result")
    public void logAudited(JoinPoint joinPoint, Audited audited, Object result) {
        Object[] args = joinPoint.getArgs();

        Long entityId = firstLongArg(args);
        AppUser actor = actorFrom(args);
        if (entityId == null) {
            entityId = idFromResult(result);
        }

        auditService.log(audited.entityType(), entityId, audited.action(), actor, null);
    }

    private Long firstLongArg(Object[] args) {
        for (Object arg : args) {
            if (arg instanceof Long l) return l;
        }
        return null;
    }

    private AppUser actorFrom(Object[] args) {
        for (Object arg : args) {
            if (arg instanceof AppUserPrincipal principal) {
                return userRepository.findById(principal.getId()).orElse(null);
            }
        }
        return null;
    }

    private Long idFromResult(Object result) {
        Object body = result instanceof ResponseEntity<?> re ? re.getBody() : result;
        if (body == null) return null;
        Long id = idFrom(body);
        if (id != null) return id;
        // The document supertype/subtype DTOs (BirthCertificateDto and its
        // 6 siblings) don't expose "id" directly -- they nest a generic
        // DocumentDto behind a "document" accessor instead, since the real
        // primary key lives on the Document row (Class Table Inheritance).
        // Unwrap that one extra level before giving up.
        try {
            Object nested = body.getClass().getMethod("document").invoke(body);
            return nested == null ? null : idFrom(nested);
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }

    private Long idFrom(Object body) {
        try {
            Object id = body.getClass().getMethod("id").invoke(body);
            return id instanceof Long l ? l : null;
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }
}
