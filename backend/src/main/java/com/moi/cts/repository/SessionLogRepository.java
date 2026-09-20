package com.moi.cts.repository;

import com.moi.cts.entity.SessionLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SessionLogRepository extends JpaRepository<SessionLog, Long> {
    Optional<SessionLog> findByJti(String jti);
    List<SessionLog> findByUserIdOrderByLoginAtDesc(Long userId);
}
