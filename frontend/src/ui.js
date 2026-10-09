// Class-name handles for the CTS design system. The actual styling lives in
// the `components` layer of tailwind.css (built from the @theme tokens), so
// changing a token or a rule there re-themes every control at once.

export const inputCls = 'field'          // <input>, <select>, date pickers (38px)
export const selectCls = 'field'
export const textareaCls = 'field'       // <textarea class="field"> auto-height
export const labelCls = 'field-label'    // 13px / 500 / slate-700 / 6px below

export const btnPrimary = 'btn-primary'
export const btnSecondary = 'btn-secondary'
export const btnDanger = 'btn-danger'
export const btnSm = 'btn-sm'
export const iconBtnCls = 'icon-btn'     // 32 x 32 row action

export const cardCls = 'card'

export const tableCls = 'data-table'
export const thCls = 'th-cell'
export const thEndCls = 'th-cell !text-end'
export const thCenterCls = 'th-cell !text-center'
export const trCls = 'data-row'
export const tdCls = 'td-cell'
export const tdEndCls = 'td-cell num-cell'      // numeric / date columns
export const tdCenterCls = 'td-cell center-cell' // status badges
