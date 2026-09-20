package com.moi.cts.entity;

/** Lifecycle of a {@link NationalIdCard} -- cards are reissued, so a
 * citizen can have more than one row over time; this tracks which is
 * current. */
public enum CardStatus {
    ACTIVE, EXPIRED, LOST, REVOKED, REISSUED
}
