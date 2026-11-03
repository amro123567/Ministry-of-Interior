import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { translations } from '../i18n/translations.js'

const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [`${p}${k}`]))
const en = new Set(flat(translations.en))
const ar = new Set(flat(translations.ar))
const get = (lang, key) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), translations[lang])

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return ['__tests__', 'i18n', 'test'].includes(e.name) ? [] : sourceFiles(p)
    return /\.jsx?$/.test(e.name) ? [p] : []
  })
}

describe('translations', () => {
  it('has exactly the same keys in English and Arabic', () => {
    expect([...en].filter((k) => !ar.has(k))).toEqual([])
    expect([...ar].filter((k) => !en.has(k))).toEqual([])
  })

  it('has no empty text', () => {
    const empty = [...en].filter((k) => get('en', k) === '' ).concat([...ar].filter((k) => get('ar', k) === ''))
    expect(empty).toEqual([])
  })

  it('has every literal key the screens ask for (a missing one shows up as raw text like "requests.title")', () => {
    const root = path.resolve(__dirname, '..')
    const missing = []
    for (const file of sourceFiles(root)) {
      const text = fs.readFileSync(file, 'utf8')
      for (const m of text.matchAll(/\bt\(\s*(['"`])([a-zA-Z0-9_.]+)\1/g)) {
        if (!en.has(m[2])) missing.push(`${path.relative(root, file)}: ${m[2]}`)
      }
    }
    expect(missing).toEqual([])
  })

  it.each([
    ['status', ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED']],
    ['sla', ['ON_TRACK', 'DUE_SOON', 'OVERDUE', 'MET', 'BREACHED']],
    ['paymentMethod', ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'WAIVED']],
    ['requests.priority', ['NORMAL', 'HIGH', 'URGENT']],
    ['paymentStatus', ['PAID', 'REVERSED']],
  ])('names every %s value in both languages', (family, values) => {
    for (const lang of ['en', 'ar']) for (const v of values) expect(get(lang, `${family}.${v}`), `${lang} ${family}.${v}`).toBeTruthy()
  })

  it('names every workflow action the seeded catalog uses', () => {
    for (const lang of ['en', 'ar']) {
      for (const a of ['Submit', 'Start review', 'Approve', 'Reject', 'Archive']) expect(get(lang, `workflow.${a}`)).toBeTruthy()
    }
  })
})
