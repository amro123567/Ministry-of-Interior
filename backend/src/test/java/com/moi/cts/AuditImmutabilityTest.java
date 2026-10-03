package com.moi.cts;

import com.moi.cts.config.AuditTableProtection;
import com.moi.cts.entity.AuditLogEntry;
import com.moi.cts.repository.AppendOnlyRepository;
import com.moi.cts.repository.AuditLogRepository;
import com.moi.cts.repository.CitizenAuditLogRepository;
import com.moi.cts.repository.DocumentValidationRepository;
import com.moi.cts.repository.PhysicalDocumentHandlingRepository;
import com.moi.cts.repository.LoginAttemptRepository;
import com.moi.cts.repository.RecordAccessLogRepository;
import com.moi.cts.repository.RequestAssignmentHistoryRepository;
import com.moi.cts.repository.RequestStateHistoryRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** The audit and history tables can be appended to and read, never changed or removed. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AuditImmutabilityTest {

    @Autowired EntityManager em;
    @Autowired AuditLogRepository auditLogRepository;
    @Autowired AuditTableProtection protection;

    @Test
    void auditRepositoriesOfferNoDeleteOrRemoveMethods() {
        List<Class<?>> repositories = List.of(
                AuditLogRepository.class, CitizenAuditLogRepository.class,
                RecordAccessLogRepository.class, LoginAttemptRepository.class,
                RequestStateHistoryRepository.class, RequestAssignmentHistoryRepository.class,
                DocumentValidationRepository.class, PhysicalDocumentHandlingRepository.class);

        for (Class<?> repository : repositories) {
            assertThat(AppendOnlyRepository.class).isAssignableFrom(repository);
            for (Method m : repository.getMethods()) {
                assertThat(m.getName())
                        .as("%s.%s", repository.getSimpleName(), m.getName())
                        .doesNotStartWith("delete")
                        .doesNotStartWith("remove");
            }
        }
    }

    @Test
    void changingALoadedAuditEntryIsIgnored() {
        AuditLogEntry entry = new AuditLogEntry();
        entry.setEntityType("TEST");
        entry.setEntityId(1L);
        entry.setAction("ORIGINAL");
        entry.setDetails("original details");
        Long id = auditLogRepository.save(entry).getId();
        em.flush();
        em.clear();

        AuditLogEntry loaded = auditLogRepository.findById(id).orElseThrow();
        loaded.setAction("TAMPERED");
        loaded.setDetails("tampered details");
        em.flush();
        em.clear();

        AuditLogEntry reloaded = auditLogRepository.findById(id).orElseThrow();
        assertThat(reloaded.getAction()).isEqualTo("ORIGINAL");
        assertThat(reloaded.getDetails()).isEqualTo("original details");
    }

    @Test
    void databaseTriggersAreOnlyInstalledOnMySql() {
        // The tests run on H2, where the protection is a deliberate no-op.
        assertThat(protection.install()).isZero();
        assertThat(AuditTableProtection.PROTECTED_TABLES).hasSize(8);
    }
}
