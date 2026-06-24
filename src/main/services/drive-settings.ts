import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { unlinkSync } from 'fs'
import { join } from 'path'
import type { DriveDestination } from '../../shared/types'

function settingsPath(): string {
  return join(app.getPath('userData'), 'drive-destination.json')
}

export function loadDriveDestination(): DriveDestination | null {
  const path = settingsPath()
  if (!existsSync(path)) return null
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as DriveDestination
    if (!data.folderId) return null
    return data
  } catch {
    return null
  }
}

export function saveDriveDestination(destination: DriveDestination): void {
  writeFileSync(settingsPath(), JSON.stringify(destination, null, 2), 'utf8')
}

export function clearDriveDestination(): void {
  const path = settingsPath()
  if (!existsSync(path)) return
  try {
    unlinkSync(path)
  } catch {
    // ignore
  }
}
