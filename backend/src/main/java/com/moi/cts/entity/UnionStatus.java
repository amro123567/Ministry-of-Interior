package com.moi.cts.entity;

/** Whether a {@link MarriageCertificate} still represents a subsisting
 * marriage. Flipped to DISSOLVED when a linked {@link DivorceCertificate}
 * is recorded. */
public enum UnionStatus {
    ACTIVE, DISSOLVED
}
