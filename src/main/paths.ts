import { existsSync } from 'fs'
import { join } from 'path'
import type { AppConfig } from '../shared/types'

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

  return candidate
}
