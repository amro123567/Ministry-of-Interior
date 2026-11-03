package com.moi.cts.repository;

import com.moi.cts.entity.ReferenceSequence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ReferenceSequenceRepository extends JpaRepository<ReferenceSequence, Integer> {

    /** Reads the year's counter row and locks it until the surrounding transaction ends. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from ReferenceSequence s where s.seqYear = :year")
    Optional<ReferenceSequence> lockByYear(@Param("year") int year);
}
