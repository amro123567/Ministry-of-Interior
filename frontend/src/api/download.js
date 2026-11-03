import client from './client.js'

/**
 * Hands a Blob to the browser as a file download.
 * The link is attached to the page while it is clicked (Firefox ignores clicks on
 * detached links) and the object URL is revoked later: revoking immediately can
 * cancel the download in some browsers.
 */
export function saveBlob(blob, filename) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}

/** Fetches a file with the signed-in user's token and hands it to the browser as a download. */
export async function downloadFile(url, params, filename) {
  const res = await client.get(url, { params, responseType: 'blob' })
  saveBlob(res.data, filename)
}

/** Fetches a CSV with the signed-in user's token and hands it to the browser as a file download. */
export async function downloadCsv(url, params, filename) {
  return downloadFile(url, params, filename)
}
