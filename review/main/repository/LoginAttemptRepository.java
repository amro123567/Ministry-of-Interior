package com.moi.cts.repository;

import com.moi.cts.entity.LoginAttempt;

import java.util.List;

public interface LoginAttemptRepository extends AppendOnlyRepository<LoginAttempt, Long> {
    List<LoginAttempt> findTop50ByOrderByAttemptedAtDescIdDesc();
    List<LoginAttempt> findByUsernameAttemptedOrderByAttemptedAtDescIdDesc(String usernameAttempted);
}
