import { describe, it, expect } from 'vitest'
import { Routes, Route } from 'react-router-dom'
import usePageTitle from '../usePageTitle.js'
import { translations } from '../i18n/translations.js'
import { renderWithProviders } from '../test/renderWithProviders.jsx'

const en = translations.en
function Probe() { usePageTitle(); return null }
const at = (route) => renderWithProviders(<Routes><Route path="*" element={<Probe />} /></Routes>, { route })

describe('browser tab title', () => {
  it('puts the page name first, followed by the system name', () => {
    at('/requests')
    expect(document.title).toBe(`${en.nav.correspondence} | ${en.app.titleSuffix}`)
  })

  it('names the dashboard and the sign-in page', () => {
    at('/')
    expect(document.title).toBe(`${en.nav.dashboard} | ${en.app.titleSuffix}`)
    at('/login')
    expect(document.title).toBe(`${en.login.staffSignIn} | ${en.app.titleSuffix}`)
  })

  it('includes the request number on a request page', () => {
    at('/requests/42')
    expect(document.title).toBe(`${en.nav.correspondence} #42 | ${en.app.titleSuffix}`)
  })

  it('falls back to the plain system title on an unknown page', () => {
    at('/somewhere/else')
    expect(document.title).toBe(en.app.title)
  })
})
