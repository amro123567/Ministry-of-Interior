package com.moi.cts.repository;

import com.moi.cts.entity.RequestStateHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RequestStateHistoryRepository extends JpaRepository<RequestStateHistory, Long> {
    List<RequestStateHistory> findByRequestIdOrderByChangedAtAsc(Long requestId);
}
