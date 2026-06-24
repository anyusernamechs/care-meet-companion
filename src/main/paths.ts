import { existsSync } from 'fs'
import { join, resolve, sep } from 'path'
import type { AppConfig } from '../shared/types'

const SESSION_ID_PATTERN =
  /^[^<>:"/\\|?*\x00-\x1f](?:[^<>:"/\\|?*\x00-\x1f]*[^<>:"/\\|?*\x00-\x1f.])?$/

export function assertSafeSessionId(sessionId: string): void {
  const trimmed = sessionId.trim()
  if (!trimmed || trimmed.length > 180) {
    throw new Error('Invalid session id.')
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('Invalid session id.')
  }
  if (!SESSION_ID_PATTERN.test(trimmed)) {
    throw new Error('Invalid session id.')
  }
}

export function resolveSessionDir(recordingsRoot: string, sessionId: string): string {
  assertSafeSessionId(sessionId)
  const root = resolve(recordingsRoot)
  const sessionDir = resolve(root, sessionId)
  if (sessionDir !== root && !sessionDir.startsWith(`${root}${sep}`)) {
    throw new Error('Invalid session path.')
  }
  return sessionDir
}

export function sanitizeFileName(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'Meeting'
  )
}

export function getRecordingsRoot(config: AppConfig): string {
  return config.synologyPath && existsSync(config.synologyPath)
    ? config.synologyPath
    : config.recordingsDir
}

export function resolveSessionFolderName(
  title: string,
  startedAt: string,
  recordingsRoot: string
): string {
  const base = sanitizeFileName(title)
  const date = new Date(startedAt)
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`

  let candidate = `${base} - ${stamp}`
  let counter = 2
  while (existsSync(join(recordingsRoot, candidate))) {
    candidate = `${base} - ${stamp} (${counter})`
    counter += 1
  }

  assertSafeSessionId(candidate)
  return candidate
}
