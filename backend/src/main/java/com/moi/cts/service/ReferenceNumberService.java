package com.moi.cts.service;

import com.moi.cts.entity.CorrespondenceRequest;
import com.moi.cts.entity.ReferenceSequence;
import com.moi.cts.repository.CorrespondenceRequestRepository;
import com.moi.cts.repository.ReferenceSequenceRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Hands out readable, sequential request references of the form
 * CTS-2026-000123 (year, then a counter that restarts every January).
 *
 * next() joins the caller's transaction, so the counter only advances if the
 * request that uses the number is actually saved: no gaps from rollbacks.
 * Concurrent callers queue on a row lock instead of colliding.
 *
 * renumberLegacy() converts references created before this format existed
 * (CTS-DEMO-1, CTS-1791053649915, ...) in creation order. It runs once at
 * startup and is a no-op when nothing is left to convert.
 */
@Service
public class ReferenceNumberService {

    public static final Pattern FORMAT = Pattern.compile("^CTS-(\\d{4})-(\\d{6,})$");

    private final ReferenceSequenceRepository sequenceRepository;
    private final ReferenceSequenceInitializer initializer;
    private final CorrespondenceRequestRepository requestRepository;

    public ReferenceNumberService(ReferenceSequenceRepository sequenceRepository,
                                  ReferenceSequenceInitializer initializer,
                                  CorrespondenceRequestRepository requestRepository) {
        this.sequenceRepository = sequenceRepository;
        this.initializer = initializer;
        this.requestRepository = requestRepository;
    }

    /** Next reference for a request created at the given moment (year is read in UTC). */
    @Transactional
    public String next(Instant createdAt) {
        int year = createdAt.atZone(ZoneOffset.UTC).getYear();
        // Create the year's row first if it is missing, using a plain (non-locking) check.
        // Locking a row that does not exist yet makes MySQL take a gap lock, which would
        // block the separate transaction that inserts it.
        if (!sequenceRepository.existsById(year)) {
            try {
                initializer.createIfMissing(year, highestExisting(year));
            } catch (DataIntegrityViolationException alreadyCreatedByAnotherRequest) {
                // fine: the row exists now, we lock it below
            }
        }
        ReferenceSequence seq = sequenceRepository.lockByYear(year)
                .orElseThrow(() -> new IllegalStateException("Could not create reference counter for " + year));
        long value = seq.getLastNumber() + 1;
        seq.setLastNumber(value);
        sequenceRepository.save(seq);
        return String.format("CTS-%d-%06d", year, value);
    }

    /** Converts every reference that is not in the CTS-YYYY-NNNNNN format. Returns how many were changed. */
    @Transactional
    public int renumberLegacy() {
        List<CorrespondenceRequest> legacy = requestRepository.findAll().stream()
                .filter(r -> !FORMAT.matcher(r.getReferenceNumber()).matches())
                .sorted(Comparator.comparing(CorrespondenceRequest::getCreatedAt)
                        .thenComparing(CorrespondenceRequest::getId))
                .toList();
        for (CorrespondenceRequest r : legacy) {
            r.setReferenceNumber(next(r.getCreatedAt()));
            requestRepository.save(r);
        }
        return legacy.size();
    }

    private long highestExisting(int year) {
        long max = 0;
        for (String ref : requestRepository.findReferenceNumbersLike("CTS-" + year + "-%")) {
            Matcher m = FORMAT.matcher(ref);
            if (m.matches() && Integer.parseInt(m.group(1)) == year) {
                max = Math.max(max, Long.parseLong(m.group(2)));
            }
        }
        return max;
    }
}
