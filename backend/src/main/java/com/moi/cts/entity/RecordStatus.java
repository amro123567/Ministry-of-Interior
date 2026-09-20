package com.moi.cts.entity;

/** Generic status shared by the smaller certificate subtypes
 * ({@link DivorceCertificate}, {@link NaturalizationRecord}) that don't
 * need a bespoke enum of their own. */
public enum RecordStatus {
    ACTIVE, SUPERSEDED, REVOKED
}
