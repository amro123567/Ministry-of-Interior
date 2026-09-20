package com.moi.cts.repository;

import com.moi.cts.entity.BirthCertificate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BirthCertificateRepository extends JpaRepository<BirthCertificate, Long> {
}
