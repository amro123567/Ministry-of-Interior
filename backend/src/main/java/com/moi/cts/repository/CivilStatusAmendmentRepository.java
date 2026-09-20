package com.moi.cts.repository;

import com.moi.cts.entity.CivilStatusAmendment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CivilStatusAmendmentRepository extends JpaRepository<CivilStatusAmendment, Long> {
    List<CivilStatusAmendment> findByCitizenIdOrderByAmendmentDateDesc(Long citizenId);
}
