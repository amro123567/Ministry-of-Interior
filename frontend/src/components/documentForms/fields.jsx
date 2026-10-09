export const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'
export const labelCls = 'block text-sm font-semibold text-slate-700 mb-1.5'

/** A labelled input bound to `values[name]`. `wide` makes it span both grid columns. */
export function Field({ id, label, name, values, set, type = 'text', required = false, wide = false, hint, step }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label className={labelCls} htmlFor={id}>
        {label} {required && <span className="text-red-500">*</span>}
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
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

export const num = (v) => (v ? Number(v) : null)
export const text = (v) => v || null
