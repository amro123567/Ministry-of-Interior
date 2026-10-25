package com.moi.cts.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Body for PUT /api/requests/{id}: the editable fields of a DRAFT request. */
public record UpdateDraftRequest(
        @NotNull Long citizenId,
        @NotNull Long documentTypeId,
        @NotNull Long officeId,
        String priority,
        @Size(max = 4000) String notes,
        String direction,
        @Size(max = 500) String subject,
        Long departmentId) {
}
