package com.moi.cts.config;

import com.moi.cts.entity.Citizen;
import com.moi.cts.entity.FamilyMember;
import com.moi.cts.entity.FamilyRecord;
import com.moi.cts.entity.GuardianshipRecord;
import com.moi.cts.entity.MarriageCertificate;
import com.moi.cts.entity.UnionStatus;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Item 8: a real, dedicated invariant-checking pass over the
 * citizen-registry data, rather than "hand-written INSERT statements"
 * whose correctness is only ever eyeballed --
 * {@code FULL_DATABASE_MIGRATION_ANALYSIS.md} names this gap directly:
 * "Seeding a believable citizen registry means generating lineage
 * graphs with no cycles, marriages/divorces that reference two citizens
 * consistently, family books with accurate head-of-household
 * relationships... This needs a real seeding script with invariant
 * checks, not hand-written INSERT statements."
 * <p>
 * {@link com.moi.cts.service.CitizenService}'s {@code applyParent()}
 * already enforces SI-1 (no lineage cycle) and SI-3 (a parent's date of
 * birth must precede the child's) one edit at a time, on whichever
 * single citizen is being written through the API. This class re-checks
 * the same two invariants in bulk, across the *entire* registry, plus a
 * handful more that only make sense checked in bulk (no duplicate
 * registry numbers, no citizen simultaneously party to two ACTIVE
 * marriages, a family record's head of household actually belonging to
 * it, no citizen guardian to themselves). It is deliberately independent
 * of the service layer's own checks: those guard against a *future* bad
 * edit made through the API; this guards against the data itself ever
 * having been wrong to begin with -- including data written straight
 * through repositories (as {@link DataSeeder} does), which bypasses
 * every service-layer guard entirely.
 * <p>
 * Every {@code verify*} method throws {@link
 * SeedInvariantViolationException} -- an unchecked, fail-fast exception
 * -- on the first violation found, rather than collecting and returning
 * a report. {@link DataSeeder} calls these once, synchronously, right
 * after seeding the citizen registry, so a violation aborts application
 * startup instead of silently serving bad demo data.
 */
@Component
public class SeedDataInvariantChecker {

    /** SI-1, SI-3, plus a bulk-only uniqueness check, across the whole registry. */
    public void verifyCitizenRegistry(List<Citizen> citizens) {
        verifyUniqueRegistryNumbers(citizens);
        for (Citizen citizen : citizens) {
            verifyNoSelfParent(citizen);
            verifyParentDatesPrecedeChild(citizen);
            verifyNoLineageCycle(citizen);
        }
    }

    public void verifyMarriages(List<MarriageCertificate> marriages) {
        Map<Long, MarriageCertificate> activeBySpouseId = new HashMap<>();
        for (MarriageCertificate marriage : marriages) {
            Citizen husband = marriage.getHusband();
            Citizen wife = marriage.getWife();
            if (husband != null && wife != null && husband.getId() != null
                    && husband.getId().equals(wife.getId())) {
                throw new SeedInvariantViolationException("Marriage " + describe(marriage)
                        + " lists the same citizen as both husband and wife.");
            }
            if (marriage.getStatus() != UnionStatus.ACTIVE) {
                continue;
            }
            for (Citizen spouse : java.util.Arrays.asList(husband, wife)) {
                if (spouse == null || spouse.getId() == null) continue;
                MarriageCertificate existing = activeBySpouseId.put(spouse.getId(), marriage);
                if (existing != null) {
                    throw new SeedInvariantViolationException("Citizen " + spouse.getRegistryNumber()
                            + " is party to two simultaneously ACTIVE marriage certificates ("
                            + describe(existing) + " and " + describe(marriage) + ").");
                }
            }
        }
    }

    public void verifyGuardianships(List<GuardianshipRecord> guardianships) {
        for (GuardianshipRecord guardianship : guardianships) {
            Citizen minor = guardianship.getMinorCitizen();
            Citizen guardian = guardianship.getGuardianCitizen();
            if (minor != null && guardian != null && minor.getId() != null
                    && minor.getId().equals(guardian.getId())) {
                throw new SeedInvariantViolationException(
                        "Citizen " + minor.getRegistryNumber() + " is listed as their own guardian.");
            }
        }
    }

    /** Every family record's head of household must actually be one of its own (still-current) members. */
    public void verifyFamilyRecords(List<FamilyRecord> familyRecords, List<FamilyMember> allMembers) {
        Map<Long, List<FamilyMember>> membersByRecordId = new HashMap<>();
        for (FamilyMember member : allMembers) {
            membersByRecordId.computeIfAbsent(member.getFamilyRecord().getId(), key -> new ArrayList<>())
                    .add(member);
        }
        for (FamilyRecord record : familyRecords) {
            Citizen head = record.getHeadOfHousehold();
            if (head == null) continue;
            List<FamilyMember> members = membersByRecordId.getOrDefault(record.getId(), List.of());
            boolean headIsAMember = members.stream()
                    .anyMatch(m -> m.getCitizen().getId().equals(head.getId()));
            if (!headIsAMember) {
                throw new SeedInvariantViolationException("Family record " + record.getFamilyBookNumber()
                        + "'s head of household (" + head.getRegistryNumber()
                        + ") is not one of its own members.");
            }
        }
    }

    private void verifyUniqueRegistryNumbers(List<Citizen> citizens) {
        Set<String> seen = new HashSet<>();
        for (Citizen citizen : citizens) {
            if (!seen.add(citizen.getRegistryNumber())) {
                throw new SeedInvariantViolationException(
                        "Duplicate registry number in citizen data: " + citizen.getRegistryNumber());
            }
        }
    }

    private void verifyNoSelfParent(Citizen citizen) {
        if (citizen.getFather() != null && citizen.getId() != null
                && citizen.getId().equals(citizen.getFather().getId())) {
            throw new SeedInvariantViolationException(
                    "Citizen " + citizen.getRegistryNumber() + " is listed as their own father.");
        }
        if (citizen.getMother() != null && citizen.getId() != null
                && citizen.getId().equals(citizen.getMother().getId())) {
            throw new SeedInvariantViolationException(
                    "Citizen " + citizen.getRegistryNumber() + " is listed as their own mother.");
        }
    }

    /** SI-3, re-checked in bulk: a parent's date of birth must precede the child's, wherever both are known. */
    private void verifyParentDatesPrecedeChild(Citizen citizen) {
        if (citizen.getDateOfBirth() == null) return;
        // Arrays.asList, not List.of -- most citizens have one or both
        // parent links null, and List.of() rejects null elements outright.
        for (Citizen parent : java.util.Arrays.asList(citizen.getFather(), citizen.getMother())) {
            if (parent == null || parent.getDateOfBirth() == null) continue;
            if (!parent.getDateOfBirth().isBefore(citizen.getDateOfBirth())) {
                throw new SeedInvariantViolationException("Citizen " + citizen.getRegistryNumber()
                        + "'s parent " + parent.getRegistryNumber()
                        + " does not have a date of birth preceding theirs.");
            }
        }
    }

    /**
     * SI-1, re-checked in bulk: walking up the father/mother chain from
     * any citizen must never loop back to that same citizen. Walks both
     * sides independently (a cycle can exist on the father side, the
     * mother side, or both) with a guard on chain length so a
     * pre-existing cycle elsewhere in bad data can't spin this loop
     * forever.
     */
    private void verifyNoLineageCycle(Citizen citizen) {
        if (citizen.getId() == null) return;
        for (boolean father : new boolean[] { true, false }) {
            Citizen ancestor = father ? citizen.getFather() : citizen.getMother();
            int guard = 0;
            while (ancestor != null && guard++ < 128) {
                if (ancestor.getId() != null && ancestor.getId().equals(citizen.getId())) {
                    throw new SeedInvariantViolationException("Lineage cycle detected: citizen "
                            + citizen.getRegistryNumber() + " is their own ancestor via the "
                            + (father ? "father" : "mother") + " line.");
                }
                ancestor = father ? ancestor.getFather() : ancestor.getMother();
            }
        }
    }

    private String describe(MarriageCertificate marriage) {
        return marriage.getContractNumber() != null ? marriage.getContractNumber()
                : "document #" + marriage.getDocumentId();
    }
}
