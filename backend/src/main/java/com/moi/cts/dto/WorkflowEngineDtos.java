package com.moi.cts.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;

/**
 * DTOs for the admin-configurable workflow engine (ERD domain 3,
 * {@code workflow_states}/{@code workflow_transitions}/
 * {@code workflow_transition_permissions}) plus the
 * {@code WorkflowInstance}/{@code WorkflowInstanceHistory} runtime pair
 * that has no ERD counterpart -- see {@code WorkflowInstance}'s Javadoc
 * for why.
 */
public class WorkflowEngineDtos {

    public record WorkflowStateDto(Long id, String code, String nameEn, String nameAr, boolean isInitial,
                                    boolean isFinal, Integer displayOrder, String colorHex, boolean isActive) {}

    public record CreateWorkflowStateRequest(@NotBlank String code, String nameEn, String nameAr,
                                              boolean isInitial, boolean isFinal, Integer displayOrder,
                                              String colorHex) {}

    public record WorkflowTransitionDto(Long id, Long fromStateId, String fromStateCode, Long toStateId,
                                         String toStateCode, String actionCode, String labelEn, String labelAr,
                                         boolean requiresComment, boolean requiresDocument, boolean isActive,
                                         List<String> requiredPermissionCodes) {}

    public record CreateWorkflowTransitionRequest(@NotNull Long fromStateId, @NotNull Long toStateId,
                                                   @NotBlank String actionCode, String labelEn, String labelAr,
                                                   boolean requiresComment, boolean requiresDocument,
                                                   List<Long> requiredPermissionIds) {}

    public record WorkflowInstanceDto(Long id, String entityType, Long entityId, Long currentStateId,
                                       String currentStateCode, Instant createdAt, Instant updatedAt) {}

    public record CreateWorkflowInstanceRequest(@NotBlank String entityType, @NotNull Long entityId) {}

    public record AvailableTransitionDto(Long id, String actionCode, String labelEn, String labelAr,
                                          String toStateCode, boolean requiresComment, boolean requiresDocument) {}

    public record ExecuteTransitionRequest(@NotBlank String actionCode, String comment) {}

    public record WorkflowInstanceHistoryDto(Long id, String fromStateCode, String toStateCode, String actionCode,
                                              String actorName, Instant occurredAt, String comment) {}
}
