package com.moi.cts.repository;

import com.moi.cts.entity.DivorceCertificate;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DivorceCertificateRepository extends JpaRepository<DivorceCertificate, Long> {
    boolean existsByMarriageCertificateDocumentId(Long marriageCertificateId);
}
