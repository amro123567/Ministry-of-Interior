package com.moi.cts.service;

import com.moi.cts.entity.ReferenceSequence;
import com.moi.cts.repository.ReferenceSequenceRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates a year's counter row in its own transaction. It is a separate bean
 * so the REQUIRES_NEW boundary goes through Spring's proxy: if two requests
 * try to create the first row of a year at the same instant, the loser's
 * insert fails inside this small transaction and cannot poison the caller's.
 */
@Component
public class ReferenceSequenceInitializer {

    private final ReferenceSequenceRepository sequenceRepository;

    public ReferenceSequenceInitializer(ReferenceSequenceRepository sequenceRepository) {
        this.sequenceRepository = sequenceRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createIfMissing(int year, long startingValue) {
        if (!sequenceRepository.existsById(year)) {
            sequenceRepository.saveAndFlush(new ReferenceSequence(year, startingValue));
        }
    }
}
