import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

interface RecordingsDirectorySettings {
  path: string
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'recordings-directory.json')
}

export function defaultRecordingsDirectory(): string {
  return join(app.getPath('videos'), 'CARE Meet Recordings')
}

export function isRecordingsDirectoryLocked(): boolean {
  return Boolean(process.env.CARE_RECORDINGS_DIR?.trim())
}

export function loadSavedRecordingsDirectory(): string | null {
  const path = settingsPath()
  if (!existsSync(path)) return null

  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as RecordingsDirectorySettings
    if (!data.path?.trim()) return null
    return resolve(data.path)
  } catch {
    return null
  }
}

export function saveRecordingsDirectory(dirPath: string): void {
  writeFileSync(settingsPath(), JSON.stringify({ path: resolve(dirPath) }, null, 2), 'utf8')
}

export function resolveRecordingsDirectory(): string {
  const fromEnv = process.env.CARE_RECORDINGS_DIR?.trim()
  if (fromEnv) {
    return fromEnv.replace(/^~/, app.getPath('home'))
  }

  const saved = loadSavedRecordingsDirectory()
  if (saved) return saved

  return defaultRecordingsDirectory()
}
