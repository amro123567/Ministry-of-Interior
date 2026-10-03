package com.moi.cts.repository;

import com.moi.cts.entity.DocumentValidation;

import java.util.List;

public interface DocumentValidationRepository extends AppendOnlyRepository<DocumentValidation, Long> {
    List<DocumentValidation> findByDocumentIdOrderByValidatedAtDescIdDesc(Long documentId);
}
