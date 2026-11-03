package com.moi.cts.entity;

/**
 * {@code MET}/{@code BREACHED} were added for the {@link SlaRecord}
 * domain (full-requirements migration punch list Item 5) -- they describe
 * a *closed* request's final SLA outcome, which the three original,
 * still-unchanged values (used by every existing live {@code
 * getSlaStatus()} caller: {@code SlaController}, {@code DashboardService},
 * {@code SlaNotificationScheduler}) have no way to express, since
 * {@code getSlaStatus()} only ever describes an *open* request's current
 * risk. Adding constants is additive and safe: every existing usage of
 * this enum is an equality check against one of the original three
 * values, never an exhaustive switch, so nothing that already works can
 * break.
 */
public enum SlaStatus {
    ON_TRACK,
    DUE_SOON,
    OVERDUE,
    MET,
    BREACHED
}
