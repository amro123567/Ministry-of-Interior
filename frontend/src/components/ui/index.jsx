import { Link } from 'react-router-dom'
import { iconBtnCls } from '../../ui.js'

// Shared primitives for the CTS design system.

// 32 x 32 icon-only action with an accessible name and a native tooltip.
export function IconButton({ label, to, onClick, children, className = '', ...rest }) {
  const props = { 'aria-label': label, title: label, className: `${iconBtnCls} ${className}`, ...rest }
  if (to) return <Link to={to} {...props}>{children}</Link>
  return <button type="button" onClick={onClick} {...props}>{children}</button>
}

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
