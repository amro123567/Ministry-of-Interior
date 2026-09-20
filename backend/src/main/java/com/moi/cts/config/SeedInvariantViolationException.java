package com.moi.cts.config;

/**
 * Thrown by {@link SeedDataInvariantChecker} when the seeded (or, in
 * principle, any) citizen-registry dataset violates one of the
 * service-layer invariants the schema itself cannot express -- a
 * lineage cycle, a parent born after their child, two citizens each
 * others' spouse in a marriage record they weren't actually part of,
 * and so on. Deliberately an unchecked, fail-fast exception: {@link
 * DataSeeder} lets it propagate and abort startup rather than silently
 * booting with bad demo data, which is exactly the "citizen who is
 * their own grandparent" failure mode {@code
 * FULL_DATABASE_MIGRATION_ANALYSIS.md} warned looks fine until a real
 * query blows up on it.
 */
public class SeedInvariantViolationException extends RuntimeException {

    public SeedInvariantViolationException(String message) {
        super(message);
    }
}
