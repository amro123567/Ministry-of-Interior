package com.moi.cts.repository;

import com.moi.cts.entity.DocumentTypeAuthority;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentTypeAuthorityRepository extends JpaRepository<DocumentTypeAuthority, Long> {
    List<DocumentTypeAuthority> findByDocumentTypeId(Long documentTypeId);
}
