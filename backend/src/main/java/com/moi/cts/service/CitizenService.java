package com.moi.cts.service;

import com.moi.cts.dto.CitizenDtos.*;
import com.moi.cts.entity.Citizen;
import com.moi.cts.entity.Office;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.CitizenRepository;
import com.moi.cts.repository.OfficeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
public class CitizenService {

    private final CitizenRepository citizenRepository;
    private final OfficeRepository officeRepository;

    public CitizenService(CitizenRepository citizenRepository, OfficeRepository officeRepository) {
        this.citizenRepository = citizenRepository;
        this.officeRepository = officeRepository;
    }

    public List<CitizenDto> search(String query) {
        List<Citizen> results = (query == null || query.isBlank())
                ? citizenRepository.findAll()
                : citizenRepository.search(query.trim());
        return results.stream().map(this::toDto).toList();
    }

    public CitizenDto get(Long id) {
        return toDto(citizenRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Citizen not found: " + id)));
    }

    @Transactional
    public CitizenDto create(CreateCitizenRequest request) {
        if (request.dateOfBirth() != null && request.dateOfBirth().isAfter(LocalDate.now())) {
            throw new BadRequestException("Date of birth cannot be in the future.");
        }
        Citizen citizen = new Citizen();
        citizen.setRegistryNumber(request.registryNumber());
        citizen.setFirstNameEn(request.firstNameEn());
        citizen.setLastNameEn(request.lastNameEn());
        citizen.setFirstNameAr(request.firstNameAr());
        citizen.setLastNameAr(request.lastNameAr());
        citizen.setDateOfBirth(request.dateOfBirth());
        citizen.setGender(request.gender());
        if (request.officeId() != null) {
            Office office = officeRepository.findById(request.officeId())
                    .orElseThrow(() -> new NotFoundException("Office not found: " + request.officeId()));
            citizen.setRegisteredOffice(office);
        }
        return toDto(citizenRepository.save(citizen));
    }

    private CitizenDto toDto(Citizen c) {
        return new CitizenDto(c.getId(), c.getRegistryNumber(), c.getFirstNameEn(), c.getLastNameEn(),
                c.getFirstNameAr(), c.getLastNameAr(), c.getDateOfBirth(), c.getGender(),
                c.getRegisteredOffice() != null ? c.getRegisteredOffice().getNameEn() : null);
    }
}
