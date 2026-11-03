package com.moi.cts.repository;

import com.moi.cts.entity.Citizen;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface CitizenRepository extends JpaRepository<Citizen, Long> {

    @Query("select c from Citizen c where lower(c.firstNameEn) like lower(concat('%', :q, '%')) "
         + "or lower(c.lastNameEn) like lower(concat('%', :q, '%')) "
         + "or c.registryNumber like concat('%', :q, '%') "
         + "or c.firstNameAr like concat('%', :q, '%') "
         + "or c.lastNameAr like concat('%', :q, '%')")
    List<Citizen> search(@Param("q") String query);
}
