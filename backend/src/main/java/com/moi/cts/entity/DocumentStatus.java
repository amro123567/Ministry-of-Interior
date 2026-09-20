package com.moi.cts.entity;

/** Lifecycle of a {@link Document} row. Validation-workflow states
 * (pending/validated/rejected, per {@code document_validations} in the
 * corrected ERD) are out of this item's scope -- deferred, since that
 * table is a separate concern from the supertype/subtype split this item
 * implements. */
public enum DocumentStatus {
    DRAFT, ISSUED, REVOKED, SUPERSEDED, EXPIRED
}
