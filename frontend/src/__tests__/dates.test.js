import { describe, it, expect } from 'vitest'
import { fmtDate, toDate, todayISO } from '../utils/dates.js'

describe('fmtDate', () => {
  it('shows a date-only value as that same calendar day, never the day before', () => {
    // new Date('1990-05-10') is UTC midnight and shows May 9 west of UTC
    expect(fmtDate('1990-05-10', 'yyyy-MM-dd')).toBe('1990-05-10')
    expect(fmtDate('1990-05-10', 'MMM d, yyyy')).toBe('May 10, 1990')
  })

  it('keeps the exact instant of a full timestamp', () => {
    const iso = '2026-11-03T10:30:00Z'
    expect(toDate(iso).getTime()).toBe(Date.parse(iso))
  })

  it('uses Arabic month names when the interface language is Arabic', () => {
    document.documentElement.lang = 'ar'
    try {
      expect(fmtDate('2026-11-03', 'MMMM')).not.toBe('November')
      expect(fmtDate('2026-11-03', 'MMMM')).toMatch(/[\u0600-\u06FF]/)
    } finally {
      document.documentElement.lang = 'en'
    }
    expect(fmtDate('2026-11-03', 'MMMM')).toBe('November')
  })

  it('returns the fallback instead of throwing for missing or unreadable values', () => {
    expect(fmtDate(null)).toBe('')
    expect(fmtDate(undefined)).toBe('')
    expect(fmtDate('')).toBe('')
    expect(fmtDate('not a date')).toBe('')
    expect(fmtDate('not a date', 'yyyy', '—')).toBe('—')
  })
})

describe('todayISO', () => {
  it("uses the user's own calendar day, not the UTC day", () => {
    // 00:30 on 4 November in the machine's own time zone: toISOString() would say 3 Nov east of UTC
    expect(todayISO(new Date(2026, 10, 4, 0, 30))).toBe('2026-11-04')
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
