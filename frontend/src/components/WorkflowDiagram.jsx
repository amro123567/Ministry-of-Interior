import { useMemo } from 'react'

const NODE_W = 150
const NODE_H = 40
const COL_GAP = 90
const ROW_GAP = 36
const PAD = 24

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
  const height = PAD * 2 + tallest * NODE_H + (tallest - 1) * ROW_GAP + 70 // room for loop-backs
  const width = PAD * 2 + cols.length * NODE_W + (cols.length - 1) * COL_GAP

  const pos = new Map()
  cols.forEach((col, ci) => {
    const colH = col.length * NODE_H + (col.length - 1) * ROW_GAP
    const top = PAD + (tallest * NODE_H + (tallest - 1) * ROW_GAP - colH) / 2
    col.forEach((s, ri) => {
      pos.set(s.code, { x: PAD + ci * (NODE_W + COL_GAP), y: top + ri * (NODE_H + ROW_GAP), col: ci, state: s })
    })
  })
  return { pos, width, height, baseline: PAD + tallest * NODE_H + (tallest - 1) * ROW_GAP }
}

function edgePath(a, b, index, baseline) {
  if (b.col > a.col) {
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2
    const x2 = b.x, y2 = b.y + NODE_H / 2
    const mx = (x1 + x2) / 2
    return { d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, lx: mx, ly: (y1 + y2) / 2 - 4 }
  }
  // same column or backwards: leave from the bottom of the source, come in at the bottom of the target
  const x1 = a.x + NODE_W / 2 + (index % 3) * 10 - 10, y1 = a.y + NODE_H
  const x2 = b.x + NODE_W / 2 + (index % 3) * 10 - 10, y2 = b.y + NODE_H
  const dip = baseline + 22 + (index % 3) * 14
  return { d: `M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`, lx: (x1 + x2) / 2, ly: dip - 2 }
}

export default function WorkflowDiagram({ states, transitions, lang, label, currentCode }) {
  const model = useMemo(() => layout(states, transitions), [states, transitions])
  if (states.length === 0) return null
  const { pos, width, height, baseline } = model

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/60">
      <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block mx-auto">
        <defs>
          <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94A3B8" />
          </marker>
        </defs>

        {transitions.map((tr, i) => {
          const a = pos.get(tr.fromStateCode), b = pos.get(tr.toStateCode)
          if (!a || !b) return null
          const { d, lx, ly } = edgePath(a, b, i, baseline)
          const text = (lang === 'ar' ? tr.labelAr : tr.labelEn) || tr.actionCode
          return (
            <g key={tr.id}>
              <path d={d} fill="none" stroke="#94A3B8" strokeWidth="1.5" markerEnd="url(#wf-arrow)" />
              <text x={lx} y={ly} textAnchor="middle" fontSize="10" fill="#64748B" stroke="#F8FAFC" strokeWidth="3" paintOrder="stroke">{text}</text>
            </g>
          )
        })}

        {[...pos.values()].map(({ x, y, state }) => {
          const color = state.colorHex || '#94A3B8'
          const isCurrent = state.code === currentCode
          const name = (lang === 'ar' ? state.nameAr : state.nameEn) || state.code
          return (
            <g key={state.code}>
              <rect x={x} y={y} width={NODE_W} height={NODE_H} rx="20" fill="#fff" stroke={color} strokeWidth={isCurrent ? 3.5 : state.isFinal ? 3 : 1.5} />
              {state.isInitial && <circle cx={x + 12} cy={y + NODE_H / 2} r="3.5" fill={color} />}
              <text x={x + NODE_W / 2} y={y + NODE_H / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill={color}>{name}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
