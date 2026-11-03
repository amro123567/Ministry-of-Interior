package com.moi.cts.repository;

import com.moi.cts.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByCitizenId(Long citizenId);
}
