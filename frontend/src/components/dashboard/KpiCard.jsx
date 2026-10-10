import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

// Accent per semantic state: top border, icon container and spark colour.
const TONES = {
  brand: { bar: 'bg-brand', icon: 'bg-brand-tint text-brand', stroke: '#2563EB', value: 'text-navy' },
  crit: { bar: 'bg-crit', icon: 'bg-crit-tint text-crit-ink', stroke: '#EF4444', value: 'text-crit-ink' },
  warn: { bar: 'bg-warn', icon: 'bg-warn-tint text-warn-ink', stroke: '#F59E0B', value: 'text-warn-ink' },
  active: { bar: 'bg-active', icon: 'bg-active-tint text-active', stroke: '#4F46E5', value: 'text-navy' },
  ok: { bar: 'bg-ok', icon: 'bg-ok-tint text-ok-ink', stroke: '#10B981', value: 'text-navy' },
}

/** Tiny dependency-free area sparkline. `values` are plotted left to right. */
export function Sparkline({ values, stroke, label }) {
  const w = 120
  const h = 36
  if (!values || values.length < 2) return null
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const id = `spark-${stroke.replace('#', '')}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full max-w-[120px] rtl:-scale-x-100" role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Circular gauge, 0..100. */
export function Gauge({ percent, stroke, label }) {
  const r = 16
  const c = 2 * Math.PI * r
  const p = Math.max(0, Math.min(100, percent))
  return (
    <svg viewBox="0 0 40 40" className="h-11 w-11 shrink-0 -rotate-90" role="img" aria-label={label}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="#E2E8F0" strokeWidth="5" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`} />
    </svg>
  )
}

/**
 * Trend pill. `direction` is the sign of the change; `good` says whether that
 * direction is desirable (more requests = neutral, more overdue = bad).
 */
export function TrendPill({ pct, suffix, good = 'neutral' }) {
  const up = pct > 0
  const flat = pct === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  const tone = flat || good === 'neutral'
    ? 'bg-slate-100 text-slate-700'
    : (up === (good === 'up')) ? 'bg-ok-tint text-ok-ink' : 'bg-crit-tint text-crit-ink'
  return (
    <span className={`dash-chip border-transparent ${tone}`}>
      <Icon size={12} aria-hidden="true" />
      {up ? '+' : ''}{pct}%
      {suffix && <span className="font-semibold opacity-80">{suffix}</span>}
    </span>
  )
}

export default function KpiCard({ icon: Icon, tone = 'brand', label, value, unit, to, footer, visual, testId, emphasis = false }) {
  const c = TONES[tone]
  const Wrapper = to ? Link : 'div'
  return (
    <Wrapper
      {...(to ? { to } : {})}
      data-testid={testId}
      className={`dash-card group relative flex flex-col overflow-hidden p-5 ${
        emphasis ? 'ring-1 ring-crit/25 bg-gradient-to-b from-crit-tint/60 to-white ' : ''
      }${
        to ? 'transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md' : ''
      }`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${c.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${c.icon}`}><Icon size={20} aria-hidden="true" /></div>
        {visual && <div className="flex min-w-0 flex-1 justify-end">{visual(c.stroke)}</div>}
      </div>
      <div className="mt-4 text-[13px] font-semibold text-slate-600">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1 text-[32px] font-extrabold leading-none tracking-tight tabular-nums ${c.value}`}>
        {value}
        {unit && <span className="text-base font-bold text-slate-500">{unit}</span>}
      </div>
      {footer && <div className="mt-3 flex min-h-[22px] flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">{footer}</div>}
    </Wrapper>
  )
}
