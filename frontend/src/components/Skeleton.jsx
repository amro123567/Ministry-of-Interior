// Shimmer loading placeholders used while dashboard/table data loads,
// instead of a bare "Loading…" line. Uses Tailwind's built-in animate-pulse.
export function SkeletonLine({ width = '100%', height = 14, className = '' }) {
  return <span className={`block animate-pulse rounded bg-slate-200 ${className}`} style={{ width, height }} />
}

export function SkeletonKpiRow({ count = 5 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3.5">
          <div className="h-10 w-10 rounded-[10px] bg-slate-100 animate-pulse" />
          <div>
            <SkeletonLine width="60%" height={22} />
            <SkeletonLine width="80%" height={11} className="mt-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonTableRows({ rows = 5, cols = 7 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <SkeletonLine width={c === 0 ? '80%' : '60%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
