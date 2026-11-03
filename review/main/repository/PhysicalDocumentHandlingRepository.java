package com.moi.cts.repository;

import com.moi.cts.entity.PhysicalDocumentHandling;

import java.util.List;

public interface PhysicalDocumentHandlingRepository extends AppendOnlyRepository<PhysicalDocumentHandling, Long> {
    List<PhysicalDocumentHandling> findByDocumentIdOrderByHandledAtAscIdAsc(Long documentId);
}
