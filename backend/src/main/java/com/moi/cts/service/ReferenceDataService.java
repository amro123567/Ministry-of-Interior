package com.moi.cts.service;

import com.moi.cts.dto.ReferenceDtos.*;
import com.moi.cts.repository.DocumentTypeRepository;
import com.moi.cts.repository.OfficeRepository;
import com.moi.cts.repository.RoleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ReferenceDataService {

    private final OfficeRepository officeRepository;
    private final DocumentTypeRepository documentTypeRepository;
    private final RoleRepository roleRepository;

    public ReferenceDataService(OfficeRepository officeRepository, DocumentTypeRepository documentTypeRepository,
                                 RoleRepository roleRepository) {
        this.officeRepository = officeRepository;
        this.documentTypeRepository = documentTypeRepository;
        this.roleRepository = roleRepository;
    }

    public List<OfficeDto> offices() {
        return officeRepository.findAll().stream()
                .map(o -> new OfficeDto(o.getId(), o.getCode(), o.getNameEn(), o.getNameAr())).toList();
    }

    public List<DocumentTypeDto> documentTypes() {
        return documentTypeRepository.findAll().stream()
                .map(d -> new DocumentTypeDto(d.getId(), d.getCode(), d.getNameEn(), d.getNameAr(), d.getSlaDays()))
                .toList();
    }

    public List<RoleDto> roles() {
        return roleRepository.findAll().stream()
                .map(r -> new RoleDto(r.getId(), r.getName().name(), r.getDescription())).toList();
    }
}
