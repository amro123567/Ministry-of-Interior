package com.moi.cts.entity;

import jakarta.persistence.*;

import java.util.HashSet;
import java.util.Set;

/**
 * One admin-definable transition between two {@link WorkflowState}s (ERD
 * domain 3, {@code workflow_transitions} +
 * {@code workflow_transition_permissions}). The permission link reuses
 * the existing {@link Permission} entity from the RBAC migration rather
 * than inventing a parallel permission concept -- {@code Permission} was
 * already exactly "a single grantable capability" before this item.
 *
 * <p>A transition with no linked permissions is executable by any
 * authenticated actor; a transition with one or more linked permissions
 * requires the actor to hold <em>at least one</em> of them (an OR, not an
 * AND) -- the ERD's plain many-to-many junction has no "require all"
 * flag, so OR is the disclosed default, chosen because it mirrors how
 * {@code Role.grants(...)} and every other permission check in this
 * codebase already reads ("does the actor have this permission, from any
 * of their roles"), not because the ERD specifies it either way.
 *
 * <p>The ERD's {@code UNIQUE(action_code)} constraint is global, not
 * scoped per from-state -- so two transitions that both logically "mean
 * archive" (e.g. APPROVED&rarr;ARCHIVED and REJECTED&rarr;ARCHIVED) need
 * two distinct action codes. Honored faithfully rather than silently
 * loosened; see {@code DataSeeder} for the two archive action codes this
 * produces.
 */
@Entity
@Table(name = "workflow_transitions",
       uniqueConstraints = {
               @UniqueConstraint(columnNames = {"from_state_id", "to_state_id"}),
               @UniqueConstraint(columnNames = "action_code")
       })
public class WorkflowTransition extends ReferenceRecord {

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "from_state_id")
    private WorkflowState fromState;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "to_state_id")
    private WorkflowState toState;

    @Column(name = "action_code", nullable = false, length = 40)
    private String actionCode;

    @Column(name = "label_en", length = 80)
    private String labelEn;

    @Column(name = "label_ar", length = 80)
    private String labelAr;

    @Column(name = "requires_comment", nullable = false)
    private boolean requiresComment;

    @Column(name = "requires_document", nullable = false)
    private boolean requiresDocument;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "workflow_transition_permissions",
               joinColumns = @JoinColumn(name = "transition_id"),
               inverseJoinColumns = @JoinColumn(name = "permission_id"))
    private Set<Permission> requiredPermissions = new HashSet<>();

    public WorkflowState getFromState() { return fromState; }
    public void setFromState(WorkflowState fromState) { this.fromState = fromState; }
    public WorkflowState getToState() { return toState; }
    public void setToState(WorkflowState toState) { this.toState = toState; }
    public String getActionCode() { return actionCode; }
    public void setActionCode(String actionCode) { this.actionCode = actionCode; }
    public String getLabelEn() { return labelEn; }
    public void setLabelEn(String labelEn) { this.labelEn = labelEn; }
    public String getLabelAr() { return labelAr; }
    public void setLabelAr(String labelAr) { this.labelAr = labelAr; }
    public boolean isRequiresComment() { return requiresComment; }
    public void setRequiresComment(boolean requiresComment) { this.requiresComment = requiresComment; }
    public boolean isRequiresDocument() { return requiresDocument; }
    public void setRequiresDocument(boolean requiresDocument) { this.requiresDocument = requiresDocument; }
    public Set<Permission> getRequiredPermissions() { return requiredPermissions; }
    public void setRequiredPermissions(Set<Permission> requiredPermissions) { this.requiredPermissions = requiredPermissions; }

    public boolean isPermittedFor(java.util.Set<String> actorPermissionCodes) {
        if (requiredPermissions.isEmpty()) return true;
        return requiredPermissions.stream().anyMatch(p -> actorPermissionCodes.contains(p.getCode()));
    }
}
