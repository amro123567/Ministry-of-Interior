package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * One row per calendar year holding the last reference-number counter handed
 * out for that year. Request references look like CTS-2026-000123; the
 * counter restarts at 1 every January. The row is read with a pessimistic
 * write lock (see ReferenceSequenceRepository.lockByYear) so two requests
 * created at the same moment can never receive the same number.
 *
 * Column names avoid the SQL keywords YEAR and LAST_VALUE (reserved in
 * some MySQL/H2 versions).
 */
@Entity
@Table(name = "reference_sequences")
public class ReferenceSequence {

    @Id
    @Column(name = "seq_year")
    private Integer seqYear;

    @Column(name = "last_number", nullable = false)
    private long lastNumber;

    protected ReferenceSequence() {}

    public ReferenceSequence(Integer seqYear, long lastNumber) {
        this.seqYear = seqYear;
        this.lastNumber = lastNumber;
    }

    public Integer getSeqYear() { return seqYear; }
    public long getLastNumber() { return lastNumber; }
    public void setLastNumber(long lastNumber) { this.lastNumber = lastNumber; }
}
