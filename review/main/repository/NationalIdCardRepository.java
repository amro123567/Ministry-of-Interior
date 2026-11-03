package com.moi.cts.repository;

import com.moi.cts.entity.NationalIdCard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NationalIdCardRepository extends JpaRepository<NationalIdCard, Long> {
    List<NationalIdCard> findByDocument_CitizenId(Long citizenId);
}
