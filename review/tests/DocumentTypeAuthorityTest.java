package com.moi.cts;

import com.moi.cts.dto.DocumentTypeAuthorityDtos.DocumentTypeAuthoritiesDto;
import com.moi.cts.entity.AuthorityKind;
import com.moi.cts.entity.DocumentType;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.repository.DocumentTypeRepository;
import com.moi.cts.service.DocumentTypeAuthorityService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** FR-05: the catalog of which authorities may authorise each document type. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DocumentTypeAuthorityTest {

    @Autowired DocumentTypeAuthorityService service;
    @Autowired DocumentTypeRepository documentTypeRepository;

    private DocumentType type(String code) {
        return documentTypeRepository.findAll().stream()
                .filter(t -> t.getCode().equals(code)).findFirst().orElseThrow();
    }

    @Test
    void everySeededTypeHasItsDefaultAuthoritiesAndSeedingTwiceAddsNothing() {
        service.seedDefaults();
        assertThat(service.seedDefaults()).isZero();

        DocumentTypeAuthoritiesDto marriage = service.forType(type("MARRIAGE_CERT").getId());
        assertThat(marriage.authorities()).containsExactlyInAnyOrder("OFFICE", "COURT", "RELIGIOUS_AUTHORITY");
        assertThat(service.forType(type("NATIONAL_ID").getId()).authorities()).containsExactly("OFFICE");
    }

    @Test
    void aTypeRejectsAKindOfAuthorityItsCatalogDoesNotList() {
        service.seedDefaults();
        DocumentType nationalId = type("NATIONAL_ID");
        assertThatThrownBy(() -> service.requireAllowed(nationalId, AuthorityKind.COURT))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("court");
        assertThatCode(() -> service.requireAllowed(type("BIRTH_CERT"), AuthorityKind.MUKHTAR))
                .doesNotThrowAnyException();
    }
}
