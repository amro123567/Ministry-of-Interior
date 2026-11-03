// The Dashboard's numbers are all derived here, so each helper is pinned down with small, exact inputs.
process.env.TZ = 'Asia/Beirut' // the deployment's own zone: it has a daylight-saving change on 25 Oct 2026
import { describe, it, expect } from 'vitest'
import {
  DAY, activeCount, approvalRate, slaHealth, bucketByPeriod, weekOverWeek, groupCounts, sortBySla,
  toCsv, initials, slaCountdown, humanizeHours, agingBuckets, priorityMix, assigneeLoad, parseDate,
} from '../components/dashboard/dashboardUtils.js'

describe('counts and rates', () => {
  it('counts only draft, submitted and under-review requests as active', () => {
    expect(activeCount({ DRAFT: 1, SUBMITTED: 2, UNDER_REVIEW: 3, APPROVED: 9, REJECTED: 9, ARCHIVED: 9 })).toBe(6)
    expect(activeCount()).toBe(0)
  })

  it('computes the approval rate from decided requests only, and is null when none are decided', () => {
    expect(approvalRate({ APPROVED: 3, REJECTED: 1 })).toBe(75)
    expect(approvalRate({ DRAFT: 5 })).toBeNull()
  })

  it('keeps SLA health between 0 and 100, and null with nothing active', () => {
    expect(slaHealth({ byStatus: { SUBMITTED: 4 }, overdueCount: 1 })).toBe(75)
    expect(slaHealth({ byStatus: { SUBMITTED: 1 }, overdueCount: 5 })).toBe(0)
    expect(slaHealth({ byStatus: { APPROVED: 3 }, overdueCount: 0 })).toBeNull()
  })
})

describe('bucketByPeriod', () => {
  // Tuesday 3 Nov 2026, 21:15 Beirut time -- nine days after the clocks went back
  const now = new Date(2026, 10, 3, 21, 15).getTime()

  it('makes 14 daily buckets ending with today, and 8 weekly ones', () => {
    const days = bucketByPeriod([], 'daily', now)
    expect(days).toHaveLength(14)
    expect(days[13].start).toBe(new Date(2026, 10, 3).getTime())
    expect(days[0].start).toBe(new Date(2026, 9, 21).getTime())
    expect(bucketByPeriod([], 'weekly', now)).toHaveLength(8)
  })

  it('every daily bucket starts at a local midnight, also across the daylight-saving change', () => {
    for (const b of bucketByPeriod([], 'daily', now)) {
      const d = new Date(b.start)
      expect([d.getHours(), d.getMinutes()]).toEqual([0, 0])
    }
  })

  it('puts a request created just after midnight in that day, not the day before (this drifted by an hour after DST)', () => {
    const rows = [
      { createdAt: new Date(2026, 9, 24, 0, 30).toISOString(), status: 'DRAFT' }, // before the change
      { createdAt: new Date(2026, 9, 25, 0, 30).toISOString(), status: 'SUBMITTED' }, // the 25-hour day
      { createdAt: new Date(2026, 10, 3, 9, 0).toISOString(), status: 'APPROVED' },
    ]
    const buckets = bucketByPeriod(rows, 'daily', now)
    const on = (y, m, d) => buckets.find((b) => b.start === new Date(y, m, d).getTime())
    expect(on(2026, 9, 24).DRAFT).toBe(1)
    expect(on(2026, 9, 23).total).toBe(0)
    expect(on(2026, 9, 25).SUBMITTED).toBe(1)
    expect(on(2026, 10, 3).APPROVED).toBe(1)
  })

  it('ignores rows outside the window, in the future or without a usable date', () => {
    const rows = [
      { createdAt: new Date(2026, 8, 1).toISOString(), status: 'DRAFT' },
      { createdAt: new Date(2026, 10, 5).toISOString(), status: 'DRAFT' },
      { createdAt: 'garbage', status: 'DRAFT' },
      { status: 'DRAFT' },
    ]
    expect(bucketByPeriod(rows, 'daily', now).reduce((n, b) => n + b.total, 0)).toBe(0)
  })

  it('counts every row once in the total, even one with a status the chart does not know', () => {
    const rows = [{ createdAt: new Date(2026, 10, 3, 8).toISOString(), status: 'WEIRD' }]
    const last = bucketByPeriod(rows, 'daily', now)[13]
    expect(last.total).toBe(1)
  })
})

describe('weekOverWeek', () => {
  const now = Date.UTC(2026, 10, 3, 12)
  it('compares the last 7 days with the 7 before and gives no percentage without a base', () => {
    const rows = [1, 2, 3].map((n) => ({ createdAt: new Date(now - n * DAY).toISOString() }))
      .concat([8, 9].map((n) => ({ createdAt: new Date(now - n * DAY).toISOString() })))
    expect(weekOverWeek(rows, now)).toEqual({ cur: 3, prev: 2, pct: 50 })
    expect(weekOverWeek(rows.slice(0, 3), now).pct).toBeNull()
  })
})

describe('slaCountdown / humanizeHours', () => {
  const now = Date.UTC(2026, 10, 3, 12)
  it('reports overdue, soon, ok and none', () => {
    expect(slaCountdown({ dueAt: new Date(now - 3600000).toISOString() }, now).state).toBe('overdue')
    expect(slaCountdown({ dueAt: new Date(now + 3600000).toISOString() }, now).state).toBe('soon')
    expect(slaCountdown({ dueAt: new Date(now + 5 * DAY).toISOString() }, now).state).toBe('ok')
    expect(slaCountdown({}, now).state).toBe('none')
  })
  it('keeps the used share of the window between 0 and 100', () => {
    const row = { createdAt: new Date(now - 3 * DAY).toISOString(), dueAt: new Date(now + DAY).toISOString() }
    expect(slaCountdown(row, now).pct).toBe(75)
    expect(slaCountdown({ ...row, dueAt: new Date(now - DAY).toISOString() }, now).pct).toBe(100)
  })
  it('picks minutes, hours or days', () => {
    expect(humanizeHours(0.2)).toEqual({ value: 12, unit: 'm' })
    expect(humanizeHours(0)).toEqual({ value: 1, unit: 'm' })
    expect(humanizeHours(5)).toEqual({ value: 5, unit: 'h' })
    expect(humanizeHours(72)).toEqual({ value: 3, unit: 'd' })
  })
})

describe('grouping and sorting', () => {
  it('folds the tail of a long list into "other"', () => {
    const rows = ['a', 'a', 'a', 'b', 'b', 'c', 'd', 'e', 'f'].map((k) => ({ k }))
    const out = groupCounts(rows, (r) => r.k, 3)
    expect(out).toEqual([{ name: 'a', value: 3 }, { name: 'b', value: 2 }, { name: '__other__', value: 4 }])
    expect(groupCounts(rows.slice(0, 5), (r) => r.k, 5)).toHaveLength(2)
  })

  it('sorts overdue first, then due soon, then by earliest deadline', () => {
    const rows = [
      { id: 1, slaStatus: 'ON_TRACK', dueAt: '2026-11-01T00:00:00Z' },
      { id: 2, slaStatus: 'DUE_SOON', dueAt: '2026-11-05T00:00:00Z' },
      { id: 3, slaStatus: 'OVERDUE', dueAt: '2026-11-04T00:00:00Z' },
      { id: 4, slaStatus: 'OVERDUE', dueAt: '2026-11-02T00:00:00Z' },
    ]
    expect([...rows].sort(sortBySla).map((r) => r.id)).toEqual([4, 3, 2, 1])
  })

  it('ages only active requests, and counts a missing priority as normal', () => {
    const now = Date.UTC(2026, 10, 20)
    const rows = [
      { status: 'DRAFT', createdAt: new Date(now - 1 * DAY).toISOString(), priority: 'URGENT' },
      { status: 'SUBMITTED', createdAt: new Date(now - 10 * DAY).toISOString() },
      { status: 'UNDER_REVIEW', createdAt: new Date(now - 30 * DAY).toISOString(), priority: 'HIGH' },
      { status: 'APPROVED', createdAt: new Date(now - 30 * DAY).toISOString(), priority: 'URGENT' },
    ]
    expect(agingBuckets(rows, now).map((b) => b.count)).toEqual([1, 0, 1, 1])
    expect(priorityMix(rows)).toEqual({ URGENT: 1, HIGH: 1, NORMAL: 1 })
  })

  it('shows the busiest assignees and counts the unassigned', () => {
    const rows = [
      { status: 'DRAFT', assignedToName: 'Rami', slaStatus: 'OVERDUE' },
      { status: 'DRAFT', assignedToName: 'Rami' },
      { status: 'SUBMITTED', assignedToName: 'Lina' },
      { status: 'SUBMITTED' },
      { status: 'APPROVED', assignedToName: 'Zed' },
    ]
    const out = assigneeLoad(rows)
    expect(out.list).toEqual([{ name: 'Rami', active: 2, overdue: 1 }, { name: 'Lina', active: 1, overdue: 0 }])
    expect(out.unassigned).toBe(1)
    expect(out.people).toBe(2)
  })
})

describe('small helpers', () => {
  it('makes initials from the first and last word, and a placeholder for no name', () => {
    expect(initials('Rami Haddad')).toBe('RH')
    expect(initials('  rami  ')).toBe('R')
    expect(initials('')).toBe('?')
    expect(initials(null)).toBe('?')
  })
  it('reads only valid dates', () => {
    expect(parseDate('2026-11-03T10:00:00Z')).toBeInstanceOf(Date)
    expect(parseDate('nope')).toBeNull()
    expect(parseDate(null)).toBeNull()
  })
  it('writes CSV with quoting, and defuses spreadsheet formulas', () => {
    const csv = toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=SUM(A1)', '+1'], [null, 'line\nbreak']])
    expect(csv).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=SUM(A1),\'+1\r\n,"line\nbreak"')
  })
})
