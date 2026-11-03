package com.moi.cts.service;

import com.moi.cts.dto.ReferenceDtos.*;
import com.moi.cts.entity.Permission;
import com.moi.cts.repository.CourtRepository;
import com.moi.cts.repository.DepartmentRepository;
import com.moi.cts.repository.DistrictRepository;
import com.moi.cts.repository.DocumentTypeRepository;
import com.moi.cts.repository.GovernorateRepository;
import com.moi.cts.repository.MukhtarRepository;
import com.moi.cts.repository.OfficeRepository;
import com.moi.cts.repository.PermissionRepository;
import com.moi.cts.repository.ReligiousAuthorityRepository;
import com.moi.cts.repository.RoleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReferenceDataService {

    private final OfficeRepository officeRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final RoleRepository roleRepository;
    private final GovernorateRepository governorateRepository;
    private final DistrictRepository districtRepository;
    private final DepartmentRepository departmentRepository;
    private final CourtRepository courtRepository;
    private final ReligiousAuthorityRepository religiousAuthorityRepository;
    private final MukhtarRepository mukhtarRepository;
    private final PermissionRepository permissionRepository;

    public ReferenceDataService(OfficeRepository officeRepository, DocumentTypeRepository documentTypeRepository,
                                 RoleRepository roleRepository, GovernorateRepository governorateRepository,
                                 DistrictRepository districtRepository, DepartmentRepository departmentRepository,
                                 CourtRepository courtRepository, ReligiousAuthorityRepository religiousAuthorityRepository,
                                 MukhtarRepository mukhtarRepository, PermissionRepository permissionRepository) {
        this.officeRepository = officeRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.roleRepository = roleRepository;
        this.governorateRepository = governorateRepository;
        this.districtRepository = districtRepository;
        this.departmentRepository = departmentRepository;
        this.courtRepository = courtRepository;
        this.religiousAuthorityRepository = religiousAuthorityRepository;
        this.mukhtarRepository = mukhtarRepository;
        this.permissionRepository = permissionRepository;
    }

    public List<OfficeDto> offices() {
        return officeRepository.findAll().stream()
                .map(o -> new OfficeDto(o.getId(), o.getCode(), o.getNameEn(), o.getNameAr(),
                        o.getDistrict() != null ? o.getDistrict().getId() : null))
                .toList();
    }

    public List<DocumentTypeDto> documentTypes() {
        return documentTypeRepository.findAll().stream()
                .map(d -> new DocumentTypeDto(d.getId(), d.getCode(), d.getNameEn(), d.getNameAr(), d.getSlaDays()))
                .toList();
    }

    public List<RoleDto> roles() {
        return roleRepository.findAll().stream()
                .map(r -> new RoleDto(r.getId(), r.getName().name(), r.getDescription(),
                        r.getPermissions().stream().map(Permission::getCode).sorted().toList()))
                .toList();
    }

    public List<GovernorateDto> governorates() {
        return governorateRepository.findAll().stream()
                .map(g -> new GovernorateDto(g.getId(), g.getCode(), g.getNameEn(), g.getNameAr(), g.isActive()))
                .toList();
    }

    public List<DistrictDto> districts() {
        return districtRepository.findAll().stream()
                .map(d -> new DistrictDto(d.getId(), d.getGovernorate().getId(), d.getCode(), d.getNameEn(),
                        d.getNameAr(), d.isActive()))
                .toList();
    }

    public List<DepartmentDto> departments() {
        return departmentRepository.findAll().stream()
                .map(d -> new DepartmentDto(d.getId(), d.getParent() != null ? d.getParent().getId() : null,
                        d.getCode(), d.getNameEn(), d.getNameAr(), d.getDescription(), d.isActive()))
                .toList();
    }

    public List<CourtDto> courts() {
        return courtRepository.findAll().stream()
                .map(c -> new CourtDto(c.getId(), c.getDistrict().getId(), c.getNameEn(), c.getNameAr(),
                        c.getCourtType().name(), c.getJurisdiction(), c.isActive()))
                .toList();
    }

    public List<ReligiousAuthorityDto> religiousAuthorities() {
        return religiousAuthorityRepository.findAll().stream()
                .map(r -> new ReligiousAuthorityDto(r.getId(), r.getNameEn(), r.getNameAr(), r.getReligion(),
                        r.getSect(), r.isActive()))
                .toList();
    }

    public List<MukhtarDto> mukhtars() {
        return mukhtarRepository.findAll().stream()
                .map(m -> new MukhtarDto(m.getId(), m.getDistrict().getId(), m.getFirstNameEn(), m.getLastNameEn(),
                        m.getFirstNameAr(), m.getLastNameAr(), m.getVillageOrNeighborhood(), m.getPhone(),
                        m.getEmail(), m.getTermStart(), m.getTermEnd(), m.isActive()))
                .toList();
    }

    public List<PermissionDto> permissions() {
        return permissionRepository.findAll().stream()
                .map(p -> new PermissionDto(p.getId(), p.getCode(), p.getDescription()))
                .sorted((a, b) -> a.code().compareTo(b.code()))
                .toList();
    }
}
