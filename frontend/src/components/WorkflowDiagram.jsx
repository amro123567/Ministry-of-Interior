import { useMemo, useState } from 'react'

// Node cards are white with a coloured dot (the admin-configured state colour is the ONLY
// colour a state contributes); arrows are neutral slate and turn blue only for the state
// being hovered, so the diagram stays calm and a single state's paths can be traced.
const NODE_W = 176
const NODE_H = 56
const COL_GAP = 124
const ROW_GAP = 44
const PAD = 36

/**
 * Lays states out in columns by how many steps they are from a starting state
 * (breadth-first from the initial states), then draws every transition as an arrow.
 * Arrows that go "backwards" (to a state in the same or an earlier column) loop
 * under the nodes so they never run through them.
 */
function layout(states, transitions) {
  const byCode = new Map(states.map((s) => [s.code, s]))
  const out = new Map(states.map((s) => [s.code, []]))
  transitions.forEach((tr) => {
    if (byCode.has(tr.fromStateCode) && byCode.has(tr.toStateCode)) out.get(tr.fromStateCode).push(tr.toStateCode)
  })

  const depth = new Map()
  const roots = states.filter((s) => s.isInitial)
  const queue = (roots.length ? roots : states.slice(0, 1)).map((s) => s.code)
  queue.forEach((c) => depth.set(c, 0))
  for (let i = 0; i < queue.length; i++) {
    const from = queue[i]
    for (const to of out.get(from) ?? []) {
      if (!depth.has(to)) { depth.set(to, depth.get(from) + 1); queue.push(to) }
    }
  }
  // States nothing leads to still get shown, after the reachable ones.
  const maxDepth = Math.max(0, ...depth.values())
  states.forEach((s) => { if (!depth.has(s.code)) depth.set(s.code, maxDepth + 1) })

  const columns = []
  states
    .slice()
    .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999))
    .forEach((s) => {
      const d = depth.get(s.code)
      ;(columns[d] ||= []).push(s)
    })
  const cols = columns.filter(Boolean)
  const tallest = Math.max(1, ...cols.map((c) => c.length))
  const width = PAD * 2 + cols.length * NODE_W + (cols.length - 1) * COL_GAP

  const pos = new Map()
  cols.forEach((col, ci) => {
    const colH = col.length * NODE_H + (col.length - 1) * ROW_GAP
    const top = PAD + (tallest * NODE_H + (tallest - 1) * ROW_GAP - colH) / 2
    col.forEach((s, ri) => {
      pos.set(s.code, { x: PAD + ci * (NODE_W + COL_GAP), y: top + ri * (NODE_H + ROW_GAP), col: ci, state: s })
    })
  })
  // Only reserve room under the nodes when some arrow actually loops back beneath them.
  const hasLoop = transitions.some((tr) => {
    const a = pos.get(tr.fromStateCode), b = pos.get(tr.toStateCode)
    return a && b && b.col <= a.col
  })
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP + (hasLoop ? 64 : 0)
  return { pos, width, height, baseline: PAD + tallest * NODE_H + (tallest - 1) * ROW_GAP }
}

function edgePath(a, b, index, baseline) {
  if (b.col > a.col) {
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2
    const x2 = b.x, y2 = b.y + NODE_H / 2
    const mx = (x1 + x2) / 2
    // label sits on the curve's midpoint
    return { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, lx: mx, ly: (y1 + y2) / 2 }
  }
  // same column or backwards: leave from the bottom of the source, come in at the bottom of the target
  const x1 = a.x + NODE_W / 2 + (index % 3) * 12 - 12, y1 = a.y + NODE_H
  const x2 = b.x + NODE_W / 2 + (index % 3) * 12 - 12, y2 = b.y + NODE_H
  const dip = baseline + 30 + (index % 3) * 16
  return { d: `M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: dip - 8 }
}

const LABEL_H = 20
const labelWidth = (text) => Math.max(34, Math.min(120, text.length * 6.1 + 16))

export default function WorkflowDiagram({ states, transitions, lang, label, currentCode, currentLabel = 'Current' }) {
  const model = useMemo(() => layout(states, transitions), [states, transitions])
  const [hover, setHover] = useState(null) // code of the state under the pointer
  if (states.length === 0) return null
  const { pos, width, height, baseline } = model

  // A state is "lit" when hovered or directly connected to the hovered one; everything else dims.
  const touches = (tr) => hover && (tr.fromStateCode === hover || tr.toStateCode === hover)
  const lit = new Set(hover ? [hover] : [])
  if (hover) transitions.forEach((tr) => { if (touches(tr)) { lit.add(tr.fromStateCode); lit.add(tr.toStateCode) } })

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 [background-image:radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:18px_18px]">
      <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto"
        // The drawing is laid out left-to-right in every language; Arabic labels still shape correctly inside it.
        style={{ width: '100%', minWidth: Math.min(width, 760), maxWidth: width, direction: 'ltr' }} onMouseLeave={() => setHover(null)}>
        <defs>
          <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94A3B8" />
          </marker>
          <marker id="wf-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#2563EB" />
          </marker>
          <filter id="wf-shadow" x="-10%" y="-20%" width="120%" height="150%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0F172A" floodOpacity="0.08" />
          </filter>
        </defs>

        {transitions.map((tr, i) => {
          const a = pos.get(tr.fromStateCode), b = pos.get(tr.toStateCode)
          if (!a || !b) return null
          const { d, lx, ly } = edgePath(a, b, i, baseline)
          const text = (lang === 'ar' ? tr.labelAr : tr.labelEn) || tr.actionCode
          const on = touches(tr)
          const dim = hover && !on
          const w = labelWidth(text)
          return (
            <g key={tr.id} opacity={dim ? 0.25 : 1} style={{ transition: 'opacity .15s' }}>
              <path d={d} fill="none" stroke={on ? '#2563EB' : '#CBD5E1'} strokeWidth={on ? 2.25 : 1.75} markerEnd={on ? 'url(#wf-arrow-on)' : 'url(#wf-arrow)'} />
              <rect x={lx - w / 2} y={ly - LABEL_H / 2} width={w} height={LABEL_H} rx={LABEL_H / 2} fill="#fff" stroke={on ? '#93C5FD' : '#E2E8F0'} />
              <text x={lx} y={ly + 3.6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill={on ? '#1D4ED8' : '#475569'}>{text}</text>
            </g>
          )
        })}

        {[...pos.values()].map(({ x, y, state }) => {
          const color = state.colorHex || '#94A3B8'
          const isCurrent = state.code === currentCode
          const dim = hover && !lit.has(state.code)
          const name = (lang === 'ar' ? state.nameAr : state.nameEn) || state.code
          return (
            <g key={state.code} opacity={dim ? 0.35 : 1} style={{ transition: 'opacity .15s', cursor: 'default' }}
              onMouseEnter={() => setHover(state.code)}>
              {state.isInitial && (
                // entry marker: a small arrow into the first state
                <g aria-hidden="true">
                  <circle cx={x - 22} cy={y + NODE_H / 2} r="4" fill="#0F172A" />
                  <path d={`M${x - 18},${y + NODE_H / 2} L${x - 2},${y + NODE_H / 2}`} stroke="#0F172A" strokeWidth="1.75" markerEnd="url(#wf-arrow)" />
                </g>
              )}
              <rect x={x} y={y} width={NODE_W} height={NODE_H} rx="14" fill="#fff" filter="url(#wf-shadow)"
                stroke={isCurrent ? '#2563EB' : hover === state.code ? '#94A3B8' : '#E2E8F0'} strokeWidth={isCurrent ? 2.5 : 1.25} />
              {/* a terminal state gets a second, inner outline (like a double ring) */}
              {state.isFinal && <rect x={x + 4} y={y + 4} width={NODE_W - 8} height={NODE_H - 8} rx="10" fill="none" stroke="#CBD5E1" strokeWidth="1" />}
              <circle cx={x + 22} cy={y + NODE_H / 2} r="6" fill={color} />
              <circle cx={x + 22} cy={y + NODE_H / 2} r="10" fill={color} opacity="0.15" />
              <text x={x + 40} y={y + NODE_H / 2 - 2} fontSize="13" fontWeight="700" fill="#0F172A">{name}</text>
              <text x={x + 40} y={y + NODE_H / 2 + 13} fontSize="10" fill="#64748B" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{state.code}</text>
              {isCurrent && (
                <g>
                  <rect x={x + NODE_W - 62} y={y - 9} width="54" height="18" rx="9" fill="#2563EB" />
                  <text x={x + NODE_W - 35} y={y + 3.5} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fff">{currentLabel}</text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
