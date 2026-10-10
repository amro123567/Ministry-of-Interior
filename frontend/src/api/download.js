import client from './client.js'

/** Fetches a CSV with the signed-in user's token and hands it to the browser as a file download. */
export async function downloadCsv(url, params, filename) {
  const res = await client.get(url, { params, responseType: 'blob' })
  const href = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke later: revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}
