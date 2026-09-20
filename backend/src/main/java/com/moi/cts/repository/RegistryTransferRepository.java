package com.moi.cts.repository;

import com.moi.cts.entity.RegistryTransfer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RegistryTransferRepository extends JpaRepository<RegistryTransfer, Long> {
    List<RegistryTransfer> findByCitizenId(Long citizenId);
}
