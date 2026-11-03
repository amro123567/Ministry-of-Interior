package com.moi.cts.repository;

import com.moi.cts.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByRequestId(Long requestId);
    Optional<Payment> findByReceiptNumber(String receiptNumber);
}
