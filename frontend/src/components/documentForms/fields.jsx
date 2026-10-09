export const inputCls = 'field'
export const labelCls = 'field-label'

/** A labelled input bound to `values[name]`. `wide` makes it span both grid columns. */
export function Field({ id, label, name, values, set, type = 'text', required = false, wide = false, hint, step }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className={labelCls} htmlFor={id}>
        {label} {required && <span className="text-required">*</span>}
      </label>
      <input
        id={id}
        type={type}
        step={step}
        required={required}
        className={inputCls}
        value={values[name]}
        onChange={(e) => set(name, e.target.value)}
      />
      {hint && <p className="text-xs text-text-secondary mt-1">{hint}</p>}
    </div>
  )
}

export const num = (v) => (v ? Number(v) : null)
export const text = (v) => v || null
