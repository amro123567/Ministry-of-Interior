import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../api/client.js', () => ({ default: { get: vi.fn() } }))

import client from '../api/client.js'
import { saveBlob, downloadFile, downloadCsv } from '../api/download.js'

describe('file downloads', () => {
  let click
  beforeEach(() => {
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      // the link must be part of the page while it is clicked (Firefox ignores detached links)
      this.attachedWhenClicked = document.body.contains(this)
      click.lastLink = this
    })
  })
  afterEach(() => { vi.useRealTimers(); click.mockRestore() })

  it('clicks an attached link with the file name, then removes it', () => {
    saveBlob(new Blob(['x']), 'report.csv')
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.lastLink.attachedWhenClicked).toBe(true)
    expect(click.lastLink.download).toBe('report.csv')
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('does not revoke the object URL straight away, only after the browser has had time to start the download', () => {
    saveBlob(new Blob(['x']), 'report.csv')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(10000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('fetches with the session token (through the API client) as a blob and saves it under the given name', async () => {
    client.get.mockResolvedValue({ data: new Blob(['a,b']) })
    await downloadCsv('/requests/export', { status: 'DRAFT' }, 'list.csv')
    expect(client.get).toHaveBeenCalledWith('/requests/export', { params: { status: 'DRAFT' }, responseType: 'blob' })
    expect(click.lastLink.download).toBe('list.csv')

    await downloadFile('/documents/5/download', undefined, 'scan.pdf')
    expect(client.get).toHaveBeenLastCalledWith('/documents/5/download', { params: undefined, responseType: 'blob' })
    expect(click.lastLink.download).toBe('scan.pdf')
  })

  it('lets a failed download reach the caller so the page can show its error', async () => {
    client.get.mockRejectedValue(new Error('403'))
    await expect(downloadFile('/documents/9/download', undefined, 'x.pdf')).rejects.toThrow('403')
    expect(click).not.toHaveBeenCalled()
  })
})
