package com.moi.cts.repository;

import com.moi.cts.entity.RequestStateHistory;
import java.util.List;

public interface RequestStateHistoryRepository extends AppendOnlyRepository<RequestStateHistory, Long> {
    List<RequestStateHistory> findByRequestIdOrderByChangedAtAsc(Long requestId);
}
