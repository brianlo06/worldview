// URL query-string helpers for the ask/share deep-link state. The ask surface
// hydrates from and writes to the URL so a shared link reproduces the moment.

export function readParams(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

export function writeParams(next: Record<string, string | null>) {
  const params = readParams()
  for (const [k, v] of Object.entries(next)) {
    if (v == null || v === '') params.delete(k)
    else params.set(k, v)
  }
  const qs = params.toString()
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
  window.history.replaceState(null, '', url)
}
