package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

public class DocumentReviewDtos {

    public record ValidationDto(Long id, String decision, String comment, String validatorName, Instant validatedAt) {}

    public record CustodyEventDto(Long id, String eventType, String location, String note,
                                  String handledByName, String handledByRole, Instant handledAt) {}

    /** PENDING when nobody has validated yet, otherwise the latest decision. */
    public record DocumentReviewDto(Long documentId, String validationStatus, List<ValidationDto> validations,
                                    List<CustodyEventDto> custody) {}

    public record ValidateDocumentRequest(@NotNull String decision, @Size(max = 500) String comment) {}

    public record RecordCustodyRequest(@NotNull String eventType, @NotBlank @Size(max = 200) String location,
                                       @Size(max = 500) String note) {}
}
