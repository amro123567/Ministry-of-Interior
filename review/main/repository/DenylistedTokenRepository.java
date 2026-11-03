package com.moi.cts.repository;

import com.moi.cts.entity.DenylistedToken;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DenylistedTokenRepository extends JpaRepository<DenylistedToken, Long> {
    boolean existsByJti(String jti);
}
