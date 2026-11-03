package com.moi.cts.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.List;

/**
 * Makes the audit and history tables append-only at database level.
 *
 * On MySQL / MariaDB it creates a BEFORE UPDATE and a BEFORE DELETE trigger on each
 * protected table; the trigger raises an error, so even a hand-written SQL statement
 * (or a bug) cannot change or remove an audit row. Existing triggers are left alone,
 * so the step is safe to run on every startup. Other databases (H2 in the tests) are
 * skipped: there the protection is the code layer only (@Immutable entities and
 * repositories without delete methods).
 *
 * If the database user lacks the privilege to create triggers the problem is logged
 * as a warning and startup continues.
 */
@Component
public class AuditTableProtection {

    private static final Logger log = LoggerFactory.getLogger(AuditTableProtection.class);

    public static final List<String> PROTECTED_TABLES = List.of(
            "audit_log",
            "citizen_audit_log",
            "record_access_log",
            "login_attempts",
            "request_state_history",
            "request_assignment_history",
            "document_validations",
            "physical_document_handling");

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    public AuditTableProtection(DataSource dataSource, JdbcTemplate jdbc) {
        this.dataSource = dataSource;
        this.jdbc = jdbc;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        install();
    }

    /** Returns the number of triggers created (0 when unsupported or already present). */
    public int install() {
        if (!isMySqlFamily()) {
            log.info("Audit table triggers skipped: database is not MySQL/MariaDB");
            return 0;
        }
        int created = 0;
        for (String table : PROTECTED_TABLES) {
            created += ensureTrigger(table, "update");
            created += ensureTrigger(table, "delete");
        }
        log.info("Audit table protection ready ({} trigger(s) created)", created);
        return created;
    }

    private int ensureTrigger(String table, String operation) {
        String name = "trg_" + table + "_no_" + operation;
        try {
            Integer existing = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.triggers "
                            + "WHERE trigger_schema = DATABASE() AND trigger_name = ?",
                    Integer.class, name);
            if (existing != null && existing > 0) {
                return 0;
            }
            jdbc.execute("CREATE TRIGGER " + name + " BEFORE " + operation.toUpperCase()
                    + " ON " + table + " FOR EACH ROW "
                    + "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '"
                    + table + " is append-only: rows cannot be " + operation + "d'");
            return 1;
        } catch (Exception e) {
            log.warn("Could not create trigger {}: {}", name, e.getMessage());
            return 0;
        }
    }

    private boolean isMySqlFamily() {
        try (Connection c = dataSource.getConnection()) {
            String product = c.getMetaData().getDatabaseProductName();
            return product != null && (product.toLowerCase().contains("mysql")
                    || product.toLowerCase().contains("mariadb"));
        } catch (Exception e) {
            log.warn("Could not detect database product: {}", e.getMessage());
            return false;
        }
    }
}
