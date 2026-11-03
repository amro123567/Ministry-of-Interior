package com.moi.cts;

import com.moi.cts.dto.DocumentReviewDtos.*;
import com.moi.cts.entity.Document;
import com.moi.cts.entity.DocumentStatus;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.repository.AppUserRepository;
import com.moi.cts.repository.CitizenRepository;
import com.moi.cts.repository.DocumentRepository;
import com.moi.cts.repository.DocumentTypeRepository;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.DocumentReviewService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** FR-11: multi-validator sign-off and the physical chain of custody. */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DocumentReviewTest {

    @Autowired DocumentReviewService service;
    @Autowired DocumentRepository documentRepository;
    @Autowired CitizenRepository citizenRepository;
    @Autowired DocumentTypeRepository documentTypeRepository;
    @Autowired AppUserRepository userRepository;

    private AppUserPrincipal principal(String username) {
        return new AppUserPrincipal(userRepository.findByUsername(username).orElseThrow());
    }

    private Document aDocumentIssuedBy(String username) {
        Document doc = new Document();
        doc.setCitizen(citizenRepository.findAll().get(0));
        doc.setDocumentType(documentTypeRepository.findAll().get(0));
        doc.setDocumentNumber("TEST-REVIEW-" + System.nanoTime());
        doc.setStatus(DocumentStatus.ISSUED);
        doc.setCreatedBy(userRepository.findByUsername(username).orElseThrow());
        return documentRepository.save(doc);
    }

    @Test
    void aNewDocumentIsPendingUntilSomeoneValidatesIt() {
        Document doc = aDocumentIssuedBy("officer");
        DocumentReviewDto review = service.review(doc.getId());
        assertThat(review.validationStatus()).isEqualTo("PENDING");
        assertThat(review.validations()).isEmpty();
        assertThat(review.custody()).isEmpty();
    }

    @Test
    void severalValidationsAreAllKeptAndTheLatestOneWins() {
        Document doc = aDocumentIssuedBy("officer");
        service.validate(doc.getId(), new ValidateDocumentRequest("APPROVED", "Looks fine"), principal("manager"));
        service.validate(doc.getId(), new ValidateDocumentRequest("REJECTED", "Seal is missing"), principal("admin"));

        DocumentReviewDto review = service.review(doc.getId());
        assertThat(review.validations()).hasSize(2);
        assertThat(review.validationStatus()).isEqualTo("REJECTED");
    }

    @Test
    void theIssuerCannotValidateTheirOwnDocumentAndARejectionNeedsAComment() {
        Document doc = aDocumentIssuedBy("manager");
        assertThatThrownBy(() -> service.validate(doc.getId(),
                new ValidateDocumentRequest("APPROVED", null), principal("manager")))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("issued yourself");
        assertThatThrownBy(() -> service.validate(doc.getId(),
                new ValidateDocumentRequest("REJECTED", "  "), principal("admin")))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("comment");
        assertThatThrownBy(() -> service.validate(doc.getId(),
                new ValidateDocumentRequest("MAYBE", null), principal("admin")))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void custodyMustStartWithReceivedAndKeepsTheHandlerSnapshot() {
        Document doc = aDocumentIssuedBy("officer");
        AppUserPrincipal officer = principal("officer");
        assertThatThrownBy(() -> service.recordCustody(doc.getId(),
                new RecordCustodyRequest("STORED", "Archive room 2", null), officer))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("RECEIVED");

        service.recordCustody(doc.getId(), new RecordCustodyRequest("RECEIVED", "Front desk", null), officer);
        service.recordCustody(doc.getId(), new RecordCustodyRequest("STORED", "Archive room 2", "Shelf 4"), officer);

        DocumentReviewDto review = service.review(doc.getId());
        assertThat(review.custody()).extracting(CustodyEventDto::eventType).containsExactly("RECEIVED", "STORED");
        CustodyEventDto first = review.custody().get(0);
        assertThat(first.handledByName()).isNotBlank();
        assertThat(first.handledByRole()).isNotEqualTo("UNKNOWN");
    }
}
