package com.moi.cts.repository;

import com.moi.cts.entity.FamilyMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FamilyMemberRepository extends JpaRepository<FamilyMember, Long> {
    // "which family books has this person belonged to" -- the reverse of
    // the primary navigation (family record -> members).
    List<FamilyMember> findByCitizenId(Long citizenId);

    List<FamilyMember> findByFamilyRecordId(Long familyRecordId);

    List<FamilyMember> findByFamilyRecordIdAndCitizenIdAndLeftDateIsNull(Long familyRecordId, Long citizenId);
}
