package com.moi.cts.service;

import com.moi.cts.dto.CitizenDtos.*;
import com.moi.cts.entity.AccessType;
import com.moi.cts.entity.AppUser;
import com.moi.cts.entity.Citizen;
import com.moi.cts.entity.MaritalStatus;
import com.moi.cts.entity.Office;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.CitizenRepository;
import com.moi.cts.repository.OfficeRepository;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
public class CitizenService {

    private final CitizenRepository citizenRepository;
    private final OfficeRepository officeRepository;
    private final AppUserRepository userRepository;
    private final CitizenAuditService citizenAuditService;

    public CitizenService(CitizenRepository citizenRepository, OfficeRepository officeRepository,
                           AppUserRepository userRepository, CitizenAuditService citizenAuditService) {
        this.citizenRepository = citizenRepository;
        this.officeRepository = officeRepository;
        this.userRepository = userRepository;
        this.citizenAuditService = citizenAuditService;
    }

    public List<CitizenDto> search(String query) {
        List<Citizen> results = (query == null || query.isBlank())
                ? citizenRepository.findAll()
                : citizenRepository.search(query.trim());
        return results.stream().map(this::toDto).toList();
    }

    public CitizenDto get(Long id) {
        return toDto(find(id));
    }

    /** Item 6, tier 3: logs a single-record read. See RecordAccessLog's Javadoc for the optional-reason design. */
    public void logRecordAccess(Long citizenId, AppUserPrincipal actor, String reason) {
        citizenAuditService.logAccess(find(citizenId), actor, AccessType.VIEW_RECORD, reason);
    }

    /** Item 6, tier 3: logs one row per citizen a search actually returned. */
    public void logSearchAccess(Long citizenId, AppUserPrincipal actor, String reason) {
        citizenAuditService.logAccess(find(citizenId), actor, AccessType.SEARCH_RESULT, reason);
    }

    @Transactional
    public CitizenDto create(CreateCitizenRequest request, AppUserPrincipal actor) {
        if (request.dateOfBirth() != null && request.dateOfBirth().isAfter(LocalDate.now())) {
            throw new BadRequestException("Date of birth cannot be in the future.");
        }
        Citizen citizen = new Citizen();
        citizen.setRegistryNumber(request.registryNumber());
        citizen.setFirstNameEn(request.firstNameEn());
        citizen.setMiddleNameEn(request.middleNameEn());
        citizen.setLastNameEn(request.lastNameEn());
        citizen.setFirstNameAr(request.firstNameAr());
        citizen.setMiddleNameAr(request.middleNameAr());
        citizen.setLastNameAr(request.lastNameAr());
        citizen.setDateOfBirth(request.dateOfBirth());
        citizen.setPlaceOfBirth(request.placeOfBirth());
        citizen.setGender(request.gender());
        citizen.setReligion(request.religion());
        citizen.setSect(request.sect());
        citizen.setMaritalStatus(parseMaritalStatus(request.maritalStatus()));
        citizen.setSijillReference(request.sijillReference());
        citizen.setNationality(request.nationality());
        if (request.officeId() != null) {
            citizen.setRegisteredOffice(findOffice(request.officeId()));
        }

        // Lineage (FR-02) + SI-4 (father_id XOR father_name_unregistered,
        // same for mother) validated up front, since a brand-new citizen
        // can't yet be anyone's ancestor -- SI-1's cycle check only
        // becomes meaningful once lineage can be edited on an *existing*
        // citizen, which is what updateLineage() below is for.
        applyParent(citizen, true, request.fatherId(), request.fatherNameUnregistered());
        applyParent(citizen, false, request.motherId(), request.motherNameUnregistered());

        if (actor != null) {
            AppUser user = userRepository.findById(actor.getId()).orElse(null);
            citizen.setCreatedBy(user);
        }
        return toDto(citizenRepository.save(citizen));
    }

    /**
     * Links or corrects a citizen's father/mother after both records
     * already exist -- e.g. a child registered before a parent's own
     * registry number was known. Runs all three lineage invariants the
     * schema itself can't express (SI-1/SI-3/SI-4).
     */
    @Transactional
    public CitizenDto updateLineage(Long id, LineageUpdateRequest request, AppUserPrincipal actor) {
        Citizen citizen = find(id);
        String oldFather = describeParent(citizen, true);
        String oldMother = describeParent(citizen, false);
        applyParent(citizen, true, request.fatherId(), request.fatherNameUnregistered());
        applyParent(citizen, false, request.motherId(), request.motherNameUnregistered());
        Citizen saved = citizenRepository.save(citizen);

        // Item 6, tier 2: field-level change log for the two lineage
        // fields, mirroring exactly what CitizenRegistryService does for
        // amendment- and transfer-driven changes -- amendmentId left
        // null here since a lineage correction isn't backed by one.
        AppUser changedBy = actor == null ? null : userRepository.findById(actor.getId()).orElse(null);
        citizenAuditService.logFieldChange(saved, null, "father", oldFather, describeParent(saved, true),
                changedBy, "Lineage correction");
        citizenAuditService.logFieldChange(saved, null, "mother", oldMother, describeParent(saved, false),
                changedBy, "Lineage correction");
        return toDto(saved);
    }

    /** A stable, comparable string for a citizen's current father/mother side, for before/after audit logging. */
    private String describeParent(Citizen citizen, boolean isFather) {
        Citizen parent = isFather ? citizen.getFather() : citizen.getMother();
        if (parent != null) return "citizen:" + parent.getId();
        String unregistered = isFather ? citizen.getFatherNameUnregistered() : citizen.getMotherNameUnregistered();
        return unregistered == null ? null : "unregistered:" + unregistered;
    }

    private void applyParent(Citizen citizen, boolean isFather, Long parentId, String unregisteredName) {
        if (parentId == null && unregisteredName == null) {
            return; // nothing to change on this side
        }
        if (parentId != null && unregisteredName != null) {
            throw new BadRequestException((isFather ? "Father" : "Mother")
                    + " must be either a registered citizen or an unregistered name, not both.");
        }
        if (unregisteredName != null) {
            if (isFather) { citizen.setFather(null); citizen.setFatherNameUnregistered(unregisteredName); }
            else { citizen.setMother(null); citizen.setMotherNameUnregistered(unregisteredName); }
            return;
        }
        Citizen parent = citizenRepository.findById(parentId)
                .orElseThrow(() -> new NotFoundException("Citizen not found: " + parentId));
        if (parent.getId().equals(citizen.getId())) {
            throw new BadRequestException("A citizen cannot be their own parent.");
        }
        // SI-3: a parent's date of birth must precede the child's.
        if (citizen.getDateOfBirth() != null && parent.getDateOfBirth() != null
                && !parent.getDateOfBirth().isBefore(citizen.getDateOfBirth())) {
            throw new BadRequestException("A parent's date of birth must precede the child's.");
        }
        // SI-1: no cycle in the father_id/mother_id lineage -- reject if
        // the proposed parent is already a descendant of this citizen
        // (walking up from the proposed parent must never reach `citizen`
        // itself; if `citizen` has no id yet -- a brand-new row -- this
        // can never trigger, which is correct, since nothing can point to
        // a row that doesn't exist yet).
        if (citizen.getId() != null) {
            Citizen ancestor = parent;
            int guard = 0; // defends against a pre-existing cycle in bad data, not just this write
            while (ancestor != null && guard++ < 64) {
                if (ancestor.getId().equals(citizen.getId())) {
                    throw new BadRequestException("This would create a cycle in the family lineage.");
                }
                ancestor = isFather ? ancestor.getFather() : ancestor.getMother();
            }
        }
        if (isFather) { citizen.setFather(parent); citizen.setFatherNameUnregistered(null); }
        else { citizen.setMother(parent); citizen.setMotherNameUnregistered(null); }
    }

    private MaritalStatus parseMaritalStatus(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return MaritalStatus.valueOf(raw.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown marital status: " + raw);
        }
    }

    private Office findOffice(Long officeId) {
        return officeRepository.findById(officeId)
                .orElseThrow(() -> new NotFoundException("Office not found: " + officeId));
    }

    Citizen find(Long id) {
        return citizenRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Citizen not found: " + id));
    }

    // Not private: reused by RequestService to embed a citizen snapshot in
    // RequestDetailDto without duplicating this now-24-field mapping.
    CitizenDto toDto(Citizen c) {
        return new CitizenDto(c.getId(), c.getRegistryNumber(), c.getFirstNameEn(), c.getMiddleNameEn(),
                c.getLastNameEn(), c.getFirstNameAr(), c.getMiddleNameAr(), c.getLastNameAr(), c.getDateOfBirth(),
                c.getPlaceOfBirth(), c.getGender(), c.getReligion(), c.getSect(),
                c.getMaritalStatus() != null ? c.getMaritalStatus().name() : null, c.getSijillReference(),
                c.getNationality(), c.isDeceased(), c.getRegisteredOffice() != null ? c.getRegisteredOffice().getNameEn() : null,
                c.getFather() != null ? c.getFather().getId() : null,
                c.getFather() != null ? c.getFather().getFirstNameEn() + " " + c.getFather().getLastNameEn() : null,
                c.getMother() != null ? c.getMother().getId() : null,
                c.getMother() != null ? c.getMother().getFirstNameEn() + " " + c.getMother().getLastNameEn() : null,
                c.getFatherNameUnregistered(), c.getMotherNameUnregistered());
    }
}
