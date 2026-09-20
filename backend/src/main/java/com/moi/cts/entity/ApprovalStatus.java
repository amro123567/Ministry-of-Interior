package com.moi.cts.entity;

/** Shared by {@link RegistryTransfer} and {@link CivilStatusAmendment}, both
 *  of which the ERD types as {@code enum_approval_status}. */
public enum ApprovalStatus {
    PENDING,
    APPROVED,
    REJECTED
}
