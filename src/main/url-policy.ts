const MEET_HOST = 'meet.google.com'

export function isAllowedMeetUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:' && parsed.hostname === MEET_HOST
  } catch {
    return false
  }
}

export function normalizeMeetUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return `https://${MEET_HOST}`
  if (isAllowedMeetUrl(trimmed)) return trimmed
  throw new Error('Only https://meet.google.com links can be opened in the app.')
}

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function normalizeExternalUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return `https://${MEET_HOST}`
  if (isAllowedExternalUrl(trimmed)) return trimmed
  throw new Error('Only http(s) links can be opened in your browser.')
}
