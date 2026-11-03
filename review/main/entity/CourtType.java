package com.moi.cts.entity;

/**
 * Simplified 3-way jurisdiction split (civil / sharia / ecclesiastical)
 * standing in for the ERD's free-form {@code enum_court_type}. Lebanon's
 * real confessional court system is more granular than this (separate
 * Sunni and Jaafari sharia courts, and a distinct ecclesiastical court per
 * Christian denomination) -- this is an honest scope simplification for a
 * demo dataset, not a claim that these three values are exhaustive.
 */
public enum CourtType {
    CIVIL,
    SHARIA,
    ECCLESIASTICAL
}
