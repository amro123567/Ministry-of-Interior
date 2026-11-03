package com.moi.cts;

import com.moi.cts.config.SeedDataInvariantChecker;
import com.moi.cts.config.SeedInvariantViolationException;
import com.moi.cts.entity.Citizen;
import com.moi.cts.entity.FamilyMember;
import com.moi.cts.entity.FamilyRecord;
import com.moi.cts.entity.FamilyRelationship;
import com.moi.cts.entity.GuardianshipRecord;
import com.moi.cts.entity.GuardianshipStatus;
import com.moi.cts.entity.GuardianshipType;
import com.moi.cts.entity.MarriageCertificate;
import com.moi.cts.entity.UnionStatus;
import com.moi.cts.repository.CitizenRepository;
import com.moi.cts.repository.FamilyMemberRepository;
import com.moi.cts.repository.FamilyRecordRepository;
import com.moi.cts.repository.GuardianshipRecordRepository;
import com.moi.cts.repository.MarriageCertificateRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Item 8: dedicated tests for {@link SeedDataInvariantChecker}, the
 * "real seeding script with invariant checks" {@code
 * FULL_DATABASE_MIGRATION_ANALYSIS.md} calls for. Two kinds of test
 * here, deliberately: (1) the checker raises nothing at all against the
 * real data {@link com.moi.cts.config.DataSeeder} actually seeded --
 * proof the seed data genuinely satisfies its own invariants, not just
 * a claim in a comment -- and (2) each violation the checker knows how
 * to detect is provoked with a small hand-built (never persisted)
 * object graph and confirmed to throw. The hand-built cases don't need
 * MockMvc, a token, or even the database -- they call the checker
 * directly with in-memory entities, which is why this is its own test
 * class rather than more additions to {@code
 * RequestWorkflowIntegrationTest} -- there's no HTTP request anywhere
 * in it.
 */
@SpringBootTest
@ActiveProfiles("test")
class SeedDataInvariantCheckerTest {

    @Autowired SeedDataInvariantChecker checker;
    @Autowired CitizenRepository citizenRepository;
    @Autowired MarriageCertificateRepository marriageCertificateRepository;
    @Autowired GuardianshipRecordRepository guardianshipRecordRepository;
    @Autowired FamilyRecordRepository familyRecordRepository;
    @Autowired FamilyMemberRepository familyMemberRepository;

    // ---- the real seeded data actually satisfies its own invariants -------

    @Test
    void theSeededCitizenRegistrySatisfiesEveryInvariant() {
        List<Citizen> citizens = citizenRepository.findAll();
        assertThat(citizens).hasSizeGreaterThanOrEqualTo(9); // c1-c7 plus the Item 8 grandparents
        checker.verifyCitizenRegistry(citizens);
    }

    @Test
    void theSeededMarriagesSatisfyEveryInvariant() {
        List<MarriageCertificate> marriages = marriageCertificateRepository.findAll();
        assertThat(marriages).isNotEmpty();
        checker.verifyMarriages(marriages);
    }

    @Test
    void theSeededGuardianshipsSatisfyEveryInvariant() {
        List<GuardianshipRecord> guardianships = guardianshipRecordRepository.findAll();
        assertThat(guardianships).isNotEmpty();
        checker.verifyGuardianships(guardianships);
    }

    @Test
    void theSeededFamilyRecordsSatisfyEveryInvariant() {
        checker.verifyFamilyRecords(familyRecordRepository.findAll(), familyMemberRepository.findAll());
    }

    // ---- each violation the checker knows about is actually caught --------

    @Test
    void aDirectLineageCycleIsDetected() {
        Citizen a = transientCitizen(1L, "REG-T001", null);
        Citizen b = transientCitizen(2L, "REG-T002", null);
        a.setFather(b);
        b.setFather(a); // a is b's father, b is a's father -- a two-hop cycle
        assertThatThrownBy(() -> checker.verifyCitizenRegistry(List.of(a, b)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("cycle");
    }

    @Test
    void aThreeGenerationLineageCycleIsDetected() {
        Citizen grandparent = transientCitizen(1L, "REG-T010", null);
        Citizen parent = transientCitizen(2L, "REG-T011", null);
        Citizen child = transientCitizen(3L, "REG-T012", null);
        parent.setFather(grandparent);
        child.setFather(parent);
        grandparent.setFather(child); // closes the loop three generations back
        assertThatThrownBy(() -> checker.verifyCitizenRegistry(List.of(grandparent, parent, child)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("cycle");
    }

    @Test
    void aCitizenListedAsTheirOwnFatherIsDetected() {
        Citizen c = transientCitizen(1L, "REG-T020", null);
        c.setFather(c);
        assertThatThrownBy(() -> checker.verifyCitizenRegistry(List.of(c)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("own father");
    }

    @Test
    void aParentBornAfterTheChildIsDetected() {
        Citizen parent = transientCitizen(1L, "REG-T030", LocalDate.of(2010, 1, 1));
        Citizen child = transientCitizen(2L, "REG-T031", LocalDate.of(2000, 1, 1));
        child.setFather(parent);
        assertThatThrownBy(() -> checker.verifyCitizenRegistry(List.of(parent, child)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("does not have a date of birth preceding");
    }

    @Test
    void duplicateRegistryNumbersAreDetected() {
        Citizen a = transientCitizen(1L, "REG-DUPLICATE", null);
        Citizen b = transientCitizen(2L, "REG-DUPLICATE", null);
        assertThatThrownBy(() -> checker.verifyCitizenRegistry(List.of(a, b)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("Duplicate registry number");
    }

    @Test
    void aMarriageListingTheSameCitizenAsHusbandAndWifeIsDetected() {
        Citizen c = transientCitizen(1L, "REG-T040", null);
        MarriageCertificate marriage = new MarriageCertificate();
        marriage.setHusband(c);
        marriage.setWife(c);
        marriage.setStatus(UnionStatus.ACTIVE);
        marriage.setContractNumber("MC-TEST-001");
        assertThatThrownBy(() -> checker.verifyMarriages(List.of(marriage)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("both husband and wife");
    }

    @Test
    void twoSimultaneouslyActiveMarriagesForTheSameSpouseAreDetected() {
        Citizen husband = transientCitizen(1L, "REG-T050", null);
        Citizen wife1 = transientCitizen(2L, "REG-T051", null);
        Citizen wife2 = transientCitizen(3L, "REG-T052", null);
        MarriageCertificate first = new MarriageCertificate();
        first.setHusband(husband);
        first.setWife(wife1);
        first.setStatus(UnionStatus.ACTIVE);
        first.setContractNumber("MC-TEST-010");
        MarriageCertificate second = new MarriageCertificate();
        second.setHusband(husband);
        second.setWife(wife2);
        second.setStatus(UnionStatus.ACTIVE);
        second.setContractNumber("MC-TEST-011");
        assertThatThrownBy(() -> checker.verifyMarriages(List.of(first, second)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("two simultaneously ACTIVE marriage certificates");
    }

    @Test
    void twoActiveMarriagesForTheSameSpouseAreAllowedIfOneIsDissolved() {
        Citizen husband = transientCitizen(1L, "REG-T060", null);
        Citizen wife1 = transientCitizen(2L, "REG-T061", null);
        Citizen wife2 = transientCitizen(3L, "REG-T062", null);
        MarriageCertificate dissolved = new MarriageCertificate();
        dissolved.setHusband(husband);
        dissolved.setWife(wife1);
        dissolved.setStatus(UnionStatus.DISSOLVED);
        dissolved.setContractNumber("MC-TEST-020");
        MarriageCertificate active = new MarriageCertificate();
        active.setHusband(husband);
        active.setWife(wife2);
        active.setStatus(UnionStatus.ACTIVE);
        active.setContractNumber("MC-TEST-021");
        checker.verifyMarriages(List.of(dissolved, active)); // must not throw
    }

    @Test
    void aCitizenListedAsTheirOwnGuardianIsDetected() {
        Citizen c = transientCitizen(1L, "REG-T070", null);
        GuardianshipRecord guardianship = new GuardianshipRecord();
        guardianship.setMinorCitizen(c);
        guardianship.setGuardianCitizen(c);
        guardianship.setGuardianshipType(GuardianshipType.FULL);
        guardianship.setStatus(GuardianshipStatus.ACTIVE);
        assertThatThrownBy(() -> checker.verifyGuardianships(List.of(guardianship)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("own guardian");
    }

    @Test
    void aFamilyRecordsHeadOfHouseholdMustBeOneOfItsOwnMembers() {
        Citizen head = transientCitizen(1L, "REG-T080", null);
        Citizen actualMember = transientCitizen(2L, "REG-T081", null);
        FamilyRecord record = new FamilyRecord();
        record.setId(100L);
        record.setFamilyBookNumber("FB-TEST-001");
        record.setHeadOfHousehold(head); // head is never added as a FamilyMember below
        FamilyMember member = new FamilyMember();
        member.setFamilyRecord(record);
        member.setCitizen(actualMember);
        member.setRelationship(FamilyRelationship.CHILD);
        member.setJoinedDate(LocalDate.of(2020, 1, 1));
        assertThatThrownBy(() -> checker.verifyFamilyRecords(List.of(record), List.of(member)))
                .isInstanceOf(SeedInvariantViolationException.class)
                .hasMessageContaining("not one of its own members");
    }

    private Citizen transientCitizen(Long id, String registryNumber, LocalDate dateOfBirth) {
        Citizen c = new Citizen();
        c.setId(id);
        c.setRegistryNumber(registryNumber);
        c.setFirstNameEn("Test");
        c.setLastNameEn("Citizen");
        c.setDateOfBirth(dateOfBirth);
        return c;
    }
}
