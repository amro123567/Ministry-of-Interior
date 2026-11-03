package com.moi.cts.service;

import com.moi.cts.dto.DocumentTypeAuthorityDtos.DocumentTypeAuthoritiesDto;
import com.moi.cts.entity.AuthorityKind;
import com.moi.cts.entity.DocumentType;
import com.moi.cts.entity.DocumentTypeAuthority;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.DocumentTypeAuthorityRepository;
import com.moi.cts.repository.DocumentTypeRepository;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

import static com.moi.cts.entity.AuthorityKind.*;

/**
 * Which kinds of authority may authorise each document type (FR-05). The catalog is
 * seeded once on startup (also for databases created before this table existed) and is
 * enforced when a document names a court, a religious authority or a mukhtar.
 */
@Service
public class DocumentTypeAuthorityService {

    /** Default catalog, by document type code. */
    static final Map<String, List<AuthorityKind>> DEFAULTS = Map.of(
            "BIRTH_CERT", List.of(OFFICE, MUKHTAR),
            "NATIONAL_ID", List.of(OFFICE),
            "PASSPORT", List.of(OFFICE),
            "MARRIAGE_CERT", List.of(OFFICE, RELIGIOUS_AUTHORITY, COURT),
            "DIVORCE_CERT", List.of(OFFICE, RELIGIOUS_AUTHORITY, COURT),
            "DEATH_CERT", List.of(OFFICE, MUKHTAR),
            "NATURALIZATION", List.of(OFFICE),
            "NAME_CHANGE", List.of(OFFICE, COURT));

    private final DocumentTypeAuthorityRepository repository;
    private final DocumentTypeRepository documentTypeRepository;

    public DocumentTypeAuthorityService(DocumentTypeAuthorityRepository repository,
                                        DocumentTypeRepository documentTypeRepository) {
        this.repository = repository;
        this.documentTypeRepository = documentTypeRepository;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onReady() {
        seedDefaults();
    }

    /** Adds any default row that is missing; returns how many were added. */
    @Transactional
    public int seedDefaults() {
        int added = 0;
        for (DocumentType type : documentTypeRepository.findAll()) {
            List<AuthorityKind> wanted = DEFAULTS.get(type.getCode());
            if (wanted == null || !repository.findByDocumentTypeId(type.getId()).isEmpty()) {
                continue;
            }
            for (AuthorityKind kind : wanted) {
                DocumentTypeAuthority row = new DocumentTypeAuthority();
                row.setDocumentType(type);
                row.setAuthorityKind(kind);
                repository.save(row);
                added++;
            }
        }
        return added;
    }

    @Transactional(readOnly = true)
    public DocumentTypeAuthoritiesDto forType(Long documentTypeId) {
        DocumentType type = documentTypeRepository.findById(documentTypeId)
                .orElseThrow(() -> new NotFoundException("Document type not found: " + documentTypeId));
        return new DocumentTypeAuthoritiesDto(type.getId(), type.getCode(),
                repository.findByDocumentTypeId(documentTypeId).stream()
                        .map(a -> a.getAuthorityKind().name()).sorted().toList());
    }

    /** Throws when the type has a catalog and it does not list this kind of authority. */
    @Transactional(readOnly = true)
    public void requireAllowed(DocumentType type, AuthorityKind kind) {
        List<DocumentTypeAuthority> allowed = repository.findByDocumentTypeId(type.getId());
        if (!allowed.isEmpty() && allowed.stream().noneMatch(a -> a.getAuthorityKind() == kind)) {
            throw new BadRequestException(type.getNameEn() + " cannot be authorised by a "
                    + kind.name().toLowerCase().replace('_', ' ') + ".");
        }
    }
}
