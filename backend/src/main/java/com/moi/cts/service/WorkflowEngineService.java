package com.moi.cts.service;

import com.moi.cts.dto.WorkflowEngineDtos.*;
import com.moi.cts.entity.*;
import com.moi.cts.exception.ApiExceptions.BadRequestException;
import com.moi.cts.exception.ApiExceptions.NotFoundException;
import com.moi.cts.repository.*;
import com.moi.cts.security.AppUserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The admin-configurable workflow engine (ERD domain 3): an admin-edited
 * catalog of {@link WorkflowState}s and {@link WorkflowTransition}s, plus
 * a {@link WorkflowInstance} runtime that actually walks a tracked
 * subject through that catalog, permission-gated, with history --
 * see {@link WorkflowInstance}'s Javadoc for why instances are keyed by
 * ({@code entityType}, {@code entityId}) rather than by a hard FK onto
 * {@code CorrespondenceRequest}, and why {@code RequestService.
 * transition()} / {@link WorkflowTransitionRule} are deliberately left
 * untouched by this item.
 *
 * <p>Two invariants are enforced here that the schema alone can't
 * express, in the same spirit as Item 2's SI-1..SI-12: at most one
 * active state may be marked {@code isInitial} (preserving the design
 * report's own "DRAFT is the sole initial status" language for whatever
 * workflow gets configured), and {@link WorkflowInstance} creation fails
 * with a clear error if the catalog has not been given exactly one such
 * state yet, rather than silently picking an arbitrary one.
 */
@Service
public class WorkflowEngineService {

    private final WorkflowStateRepository stateRepository;
    private final WorkflowTransitionRepository transitionRepository;
    private final WorkflowInstanceRepository instanceRepository;
    private final WorkflowInstanceHistoryRepository historyRepository;
    private final PermissionRepository permissionRepository;
    private final AppUserRepository userRepository;

    public WorkflowEngineService(WorkflowStateRepository stateRepository,
                                  WorkflowTransitionRepository transitionRepository,
                                  WorkflowInstanceRepository instanceRepository,
                                  WorkflowInstanceHistoryRepository historyRepository,
                                  PermissionRepository permissionRepository,
                                  AppUserRepository userRepository) {
        this.stateRepository = stateRepository;
        this.transitionRepository = transitionRepository;
        this.instanceRepository = instanceRepository;
        this.historyRepository = historyRepository;
        this.permissionRepository = permissionRepository;
        this.userRepository = userRepository;
    }

    // ==== configuration: states =============================================

    public List<WorkflowStateDto> listStates() {
        return stateRepository.findByActiveTrueOrderByDisplayOrderAsc().stream().map(this::toDto).toList();
    }

    @Transactional
    public WorkflowStateDto createState(CreateWorkflowStateRequest request) {
        if (stateRepository.findByCode(request.code()).isPresent()) {
            throw new BadRequestException("A workflow state with code '" + request.code() + "' already exists.");
        }
        if (request.isInitial() && !stateRepository.findByInitialTrueAndActiveTrue().isEmpty()) {
            throw new BadRequestException(
                    "A workflow already has an active initial state; only one is allowed at a time.");
        }
        WorkflowState state = new WorkflowState();
        state.setCode(request.code());
        state.setNameEn(request.nameEn());
        state.setNameAr(request.nameAr());
        state.setInitial(request.isInitial());
        state.setFinal(request.isFinal());
        state.setDisplayOrder(request.displayOrder());
        state.setColorHex(request.colorHex());
        return toDto(stateRepository.save(state));
    }

    // ==== configuration: transitions =========================================

    public List<WorkflowTransitionDto> listTransitions() {
        return transitionRepository.findAll().stream()
                .filter(WorkflowTransition::isActive)
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public WorkflowTransitionDto createTransition(CreateWorkflowTransitionRequest request) {
        WorkflowState from = findState(request.fromStateId());
        WorkflowState to = findState(request.toStateId());
        if (transitionRepository.existsByFromStateAndToState(from, to)) {
            throw new BadRequestException("A transition from '" + from.getCode() + "' to '"
                    + to.getCode() + "' already exists.");
        }
        if (transitionRepository.findByActionCode(request.actionCode()).isPresent()) {
            throw new BadRequestException("Action code '" + request.actionCode() + "' is already in use "
                    + "(action codes are unique system-wide, not per from-state).");
        }
        Set<Permission> required = request.requiredPermissionIds() == null ? Set.of()
                : request.requiredPermissionIds().stream().map(this::findPermission).collect(Collectors.toSet());

        WorkflowTransition transition = new WorkflowTransition();
        transition.setFromState(from);
        transition.setToState(to);
        transition.setActionCode(request.actionCode());
        transition.setLabelEn(request.labelEn());
        transition.setLabelAr(request.labelAr());
        transition.setRequiresComment(request.requiresComment());
        transition.setRequiresDocument(request.requiresDocument());
        transition.setRequiredPermissions(required);
        return toDto(transitionRepository.save(transition));
    }

    // ==== runtime: instances =================================================

    @Transactional
    public WorkflowInstanceDto createInstance(CreateWorkflowInstanceRequest request) {
        if (instanceRepository.findByEntityTypeAndEntityId(request.entityType(), request.entityId()).isPresent()) {
            throw new BadRequestException("A workflow instance already exists for "
                    + request.entityType() + "#" + request.entityId() + ".");
        }
        List<WorkflowState> initialStates = stateRepository.findByInitialTrueAndActiveTrue();
        if (initialStates.size() != 1) {
            throw new BadRequestException("The workflow catalog must have exactly one active initial state "
                    + "before an instance can be created (found " + initialStates.size() + ").");
        }
        WorkflowInstance instance = new WorkflowInstance();
        instance.setEntityType(request.entityType());
        instance.setEntityId(request.entityId());
        instance.setCurrentState(initialStates.get(0));
        return toDto(instanceRepository.save(instance));
    }

    public WorkflowInstanceDto getInstance(Long id) {
        return toDto(findInstance(id));
    }

    public List<AvailableTransitionDto> availableTransitions(Long instanceId, AppUserPrincipal actor) {
        WorkflowInstance instance = findInstance(instanceId);
        Set<String> actorPermissions = actorPermissionCodes(actor);
        return transitionRepository.findByFromStateAndActiveTrue(instance.getCurrentState()).stream()
                .filter(t -> t.isPermittedFor(actorPermissions))
                .map(t -> new AvailableTransitionDto(t.getId(), t.getActionCode(), t.getLabelEn(), t.getLabelAr(),
                        t.getToState().getCode(), t.isRequiresComment(), t.isRequiresDocument()))
                .toList();
    }

    @Transactional
    public WorkflowInstanceDto executeTransition(Long instanceId, ExecuteTransitionRequest request,
                                                  AppUserPrincipal actor) {
        WorkflowInstance instance = findInstance(instanceId);
        WorkflowTransition transition = transitionRepository.findByActionCode(request.actionCode())
                .filter(WorkflowTransition::isActive)
                .orElseThrow(() -> new NotFoundException("No active transition with action code '"
                        + request.actionCode() + "'."));

        if (!transition.getFromState().getId().equals(instance.getCurrentState().getId())) {
            throw new BadRequestException("Transition '" + request.actionCode() + "' cannot be performed from state '"
                    + instance.getCurrentState().getCode() + "' (it starts from '"
                    + transition.getFromState().getCode() + "').");
        }
        if (!transition.isPermittedFor(actorPermissionCodes(actor))) {
            throw new BadRequestException("This transition requires a permission the acting user does not hold.");
        }
        if (transition.isRequiresComment() && (request.comment() == null || request.comment().isBlank())) {
            throw new BadRequestException("Transition '" + request.actionCode() + "' requires a comment.");
        }

        WorkflowState from = instance.getCurrentState();
        instance.setCurrentState(transition.getToState());
        instanceRepository.save(instance);

        WorkflowInstanceHistory history = new WorkflowInstanceHistory();
        history.setInstance(instance);
        history.setFromState(from);
        history.setToState(transition.getToState());
        history.setTransition(transition);
        history.setActor(actor == null ? null
                : userRepository.findById(actor.getId()).orElse(null));
        history.setOccurredAt(Instant.now());
        history.setComment(request.comment());
        historyRepository.save(history);

        return toDto(instance);
    }

    public List<WorkflowInstanceHistoryDto> history(Long instanceId) {
        WorkflowInstance instance = findInstance(instanceId);
        return historyRepository.findByInstanceOrderByOccurredAtAsc(instance).stream()
                .map(h -> new WorkflowInstanceHistoryDto(h.getId(),
                        h.getFromState() == null ? null : h.getFromState().getCode(),
                        h.getToState().getCode(),
                        h.getTransition() == null ? null : h.getTransition().getActionCode(),
                        h.getActor() == null ? null : h.getActor().getFullName(),
                        h.getOccurredAt(), h.getComment()))
                .toList();
    }

    // ==== helpers ============================================================

    private Set<String> actorPermissionCodes(AppUserPrincipal actor) {
        if (actor == null) return Set.of();
        return actor.getUser().getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getCode)
                .collect(Collectors.toSet());
    }

    private WorkflowState findState(Long id) {
        return stateRepository.findById(id).orElseThrow(() -> new NotFoundException("Workflow state not found: " + id));
    }

    private Permission findPermission(Long id) {
        return permissionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Permission not found: " + id));
    }

    private WorkflowInstance findInstance(Long id) {
        return instanceRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Workflow instance not found: " + id));
    }

    private WorkflowStateDto toDto(WorkflowState s) {
        return new WorkflowStateDto(s.getId(), s.getCode(), s.getNameEn(), s.getNameAr(), s.isInitial(), s.isFinal(),
                s.getDisplayOrder(), s.getColorHex(), s.isActive());
    }

    private WorkflowTransitionDto toDto(WorkflowTransition t) {
        return new WorkflowTransitionDto(t.getId(), t.getFromState().getId(), t.getFromState().getCode(),
                t.getToState().getId(), t.getToState().getCode(), t.getActionCode(), t.getLabelEn(), t.getLabelAr(),
                t.isRequiresComment(), t.isRequiresDocument(), t.isActive(),
                t.getRequiredPermissions().stream().map(Permission::getCode).sorted().toList());
    }

    private WorkflowInstanceDto toDto(WorkflowInstance i) {
        return new WorkflowInstanceDto(i.getId(), i.getEntityType(), i.getEntityId(), i.getCurrentState().getId(),
                i.getCurrentState().getCode(), i.getCreatedAt(), i.getUpdatedAt());
    }
}
