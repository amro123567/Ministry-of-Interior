package com.moi.cts.config;

import com.moi.cts.service.ReferenceNumberService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * One-time conversion of old request references to the CTS-YYYY-NNNNNN
 * format. Runs on ApplicationReadyEvent, i.e. after every CommandLineRunner
 * (including DataSeeder) has finished, so freshly seeded demo rows are
 * converted too. Does nothing once everything is in the new format.
 */
@Component
public class ReferenceNumberMigration {

    private static final Logger log = LoggerFactory.getLogger(ReferenceNumberMigration.class);

    private final ReferenceNumberService referenceNumberService;

    public ReferenceNumberMigration(ReferenceNumberService referenceNumberService) {
        this.referenceNumberService = referenceNumberService;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void renumberLegacyReferences() {
        int changed = referenceNumberService.renumberLegacy();
        if (changed > 0) {
            log.info("Converted {} request reference(s) to the CTS-YYYY-NNNNNN format", changed);
        }
    }
}
