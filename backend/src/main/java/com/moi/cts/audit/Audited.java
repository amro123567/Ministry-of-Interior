package com.moi.cts.audit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method for automatic audit logging via
 * {@link com.moi.cts.aop.AuditLoggingAspect}. Used only for actions that
 * don't already build their own richer, hand-composed audit entry --
 * see the aspect's class comment for which ones those are and why.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Audited {
    String entityType();
    String action();
}
