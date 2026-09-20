package com.moi.cts.entity;

import jakarta.persistence.*;

/**
 * One admin-definable state in the workflow-configuration domain (ERD
 * domain 3, {@code workflow_states} -- see
 * {@code FULL_DATABASE_MIGRATION_ANALYSIS.md}'s "workflow states/
 * transitions become data an admin edits at runtime" description). This
 * is a genuinely separate catalog from {@link RequestStatus}/
 * {@link WorkflowTransitionRule}, which remain exactly as they were and
 * continue to drive the live {@code CorrespondenceRequest} workflow --
 * see this class's package-level Javadoc note in
 * {@code WorkflowEngineService} for why the two are not merged in this
 * item.
 *
 * <p>Reuses {@link ReferenceRecord} for {@code isActive}/{@code createdAt}/
 * {@code updatedAt} rather than hand-rolling those three columns again;
 * the ERD's own column list for {@code workflow_states} has no
 * {@code updated_at}, so that one column is a disclosed small addition
 * for consistency with every other reference-style table added this
 * migration, not a literal ERD column.
 */
@Entity
@Table(name = "workflow_states", uniqueConstraints = @UniqueConstraint(columnNames = "code"))
public class WorkflowState extends ReferenceRecord {

    @Column(nullable = false, length = 40)
    private String code;

    @Column(name = "name_en", length = 80)
    private String nameEn;

    @Column(name = "name_ar", length = 80)
    private String nameAr;

    @Column(name = "is_initial", nullable = false)
    private boolean initial;

    @Column(name = "is_final", nullable = false)
    private boolean isFinal;

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "color_hex", length = 7)
    private String colorHex;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getNameEn() { return nameEn; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public String getNameAr() { return nameAr; }
    public void setNameAr(String nameAr) { this.nameAr = nameAr; }
    public boolean isInitial() { return initial; }
    public void setInitial(boolean initial) { this.initial = initial; }
    public boolean isFinal() { return isFinal; }
    public void setFinal(boolean aFinal) { isFinal = aFinal; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public String getColorHex() { return colorHex; }
    public void setColorHex(String colorHex) { this.colorHex = colorHex; }
}
