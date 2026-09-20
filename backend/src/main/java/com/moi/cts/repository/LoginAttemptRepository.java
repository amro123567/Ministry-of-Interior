package com.moi.cts.repository;

import com.moi.cts.entity.LoginAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, Long> {
    List<LoginAttempt> findTop50ByOrderByAttemptedAtDesc();
    List<LoginAttempt> findByUsernameAttemptedOrderByAttemptedAtDesc(String usernameAttempted);
}
