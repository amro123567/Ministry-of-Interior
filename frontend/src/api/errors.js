// Turns a failed API call into a message the user can act on.
// 403 means the signed-in role may not do this; other errors prefer the server's own message.
export function apiErrorMessage(err, fallback, t) {
  if (err?.response?.status === 403) return t('common.noPermission')
  return err?.response?.data?.message ?? fallback
}
