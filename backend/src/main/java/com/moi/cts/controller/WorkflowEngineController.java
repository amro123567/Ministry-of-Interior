package com.moi.cts.controller;

import com.moi.cts.audit.Audited;
import com.moi.cts.dto.WorkflowEngineDtos.*;
import com.moi.cts.security.AppUserPrincipal;
import com.moi.cts.service.WorkflowEngineService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The admin-configurable workflow engine (ERD domain 3) -- see
 * {@code WorkflowEngineService}'s Javadoc for what this does and does not
 * replace. No dedicated permission gate yet, same as every other
 * reference/registry endpoint added this migration (falls under
 * {@code anyRequest().authenticated()}).
 */
@RestController
@RequestMapping("/api/workflow")
public class WorkflowEngineController {

    private final WorkflowEngineService workflowEngineService;

    public WorkflowEngineController(WorkflowEngineService workflowEngineService) {
        this.workflowEngineService = workflowEngineService;
    }

    @GetMapping("/states")
    public List<WorkflowStateDto> listStates() {
        return workflowEngineService.listStates();
    }

    @PostMapping("/states")
    @Audited(entityType = "WorkflowState", action = "CREATE")
    public WorkflowStateDto createState(@Valid @RequestBody CreateWorkflowStateRequest request) {
        return workflowEngineService.createState(request);
    }

    @GetMapping("/transitions")
    public List<WorkflowTransitionDto> listTransitions() {
        return workflowEngineService.listTransitions();
    }

    @PostMapping("/transitions")
    @Audited(entityType = "WorkflowTransition", action = "CREATE")
    public WorkflowTransitionDto createTransition(@Valid @RequestBody CreateWorkflowTransitionRequest request) {
        return workflowEngineService.createTransition(request);
    }

    @PostMapping("/instances")
    @Audited(entityType = "WorkflowInstance", action = "CREATE")
    public WorkflowInstanceDto createInstance(@Valid @RequestBody CreateWorkflowInstanceRequest request) {
        return workflowEngineService.createInstance(request);
    }

    @GetMapping("/instances/{id}")
    public WorkflowInstanceDto getInstance(@PathVariable Long id) {
        return workflowEngineService.getInstance(id);
    }

    @GetMapping("/instances/{id}/available-transitions")
    public List<AvailableTransitionDto> availableTransitions(@PathVariable Long id,
                                                              @AuthenticationPrincipal AppUserPrincipal actor) {
        return workflowEngineService.availableTransitions(id, actor);
    }

    @PostMapping("/instances/{id}/transition")
    @Audited(entityType = "WorkflowInstance", action = "TRANSITION")
    public WorkflowInstanceDto executeTransition(@PathVariable Long id,
                                                  @Valid @RequestBody ExecuteTransitionRequest request,
                                                  @AuthenticationPrincipal AppUserPrincipal actor) {
        return workflowEngineService.executeTransition(id, request, actor);
    }

    @GetMapping("/instances/{id}/history")
    public List<WorkflowInstanceHistoryDto> history(@PathVariable Long id) {
        return workflowEngineService.history(id);
    }
}
