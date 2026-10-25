import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Every test starts logged out, in English, with fresh mocks.
afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
  vi.clearAllMocks()
})
