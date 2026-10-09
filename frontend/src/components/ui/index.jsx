import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import {
  btnPrimary, btnSecondary, btnDanger, btnSm, iconBtnCls, cardCls, inputCls, textareaCls, labelCls,
} from '../../ui.js'

// Shared primitives for the CTS design system. They are thin wrappers over
// the class constants in src/ui.js (which read the @theme tokens), so pages
// can either use these components or the raw constants and look identical.

const BUTTON_VARIANTS = { primary: btnPrimary, secondary: btnSecondary, danger: btnDanger }

export const Button = forwardRef(function Button(
  { variant = 'secondary', size, className = '', type = 'button', ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${BUTTON_VARIANTS[variant] || btnSecondary} ${size === 'sm' ? btnSm : ''} ${className}`}
      {...rest}
    />
  )
})

// Link that looks like a Button (same height / radius).
export function ButtonLink({ variant = 'primary', size, className = '', ...rest }) {
  return (
    <Link
      className={`${BUTTON_VARIANTS[variant] || btnPrimary} ${size === 'sm' ? btnSm : ''} ${className}`}
      {...rest}
    />
  )
}

// 32 x 32 icon-only action with an accessible name and a native tooltip.
export function IconButton({ label, to, onClick, children, className = '', ...rest }) {
  const props = { 'aria-label': label, title: label, className: `${iconBtnCls} ${className}`, ...rest }
  if (to) return <Link to={to} {...props}>{children}</Link>
  return <button type="button" onClick={onClick} {...props}>{children}</button>
}

export function Card({ as: Tag = 'div', className = '', ...rest }) {
  return <Tag className={`${cardCls} ${className}`} {...rest} />
}

export const Input = forwardRef(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`${inputCls} ${className}`} {...rest} />
})

export const Select = forwardRef(function Select({ className = '', ...rest }, ref) {
  return <select ref={ref} className={`${inputCls} ${className}`} {...rest} />
})

export const Textarea = forwardRef(function Textarea({ className = '', ...rest }, ref) {
  return <textarea ref={ref} className={`${textareaCls} ${className}`} {...rest} />
})

export function RequiredMark() {
  return <span className="text-required ms-0.5" aria-hidden="true">*</span>
}

export function Label({ children, required, className = '', ...rest }) {
  return (
    <label className={`${labelCls} ${className}`} {...rest}>
      {children}
      {required && <RequiredMark />}
    </label>
  )
}

// ---- Badge ----------------------------------------------------------------
export const BADGE_TONES = {
  draft: 'bg-badge-draft-bg text-badge-draft-fg border-badge-draft-bd',
  info: 'bg-badge-info-bg text-badge-info-fg border-badge-info-bd',
  warning: 'bg-badge-warning-bg text-badge-warning-fg border-badge-warning-bd',
  success: 'bg-badge-success-bg text-badge-success-fg border-badge-success-bd',
  danger: 'bg-badge-danger-bg text-badge-danger-fg border-badge-danger-bd',
}

export function Badge({ tone = 'draft', className = '', children, ...rest }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 ${BADGE_TONES[tone] || BADGE_TONES.draft} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}
