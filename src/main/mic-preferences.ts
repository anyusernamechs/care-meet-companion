import { app } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

export type MicrophonePreference = 'unknown' | 'granted' | 'denied'

interface MicPreferenceStore {
  status: MicrophonePreference
}

function preferencePath(): string {
  return join(app.getPath('userData'), 'microphone-preference.json')
}

export function loadMicrophonePreference(): MicrophonePreference {
  const path = preferencePath()
  if (!existsSync(path)) return 'unknown'

  try {
    const store = JSON.parse(readFileSync(path, 'utf8')) as MicPreferenceStore
    if (store.status === 'granted' || store.status === 'denied') {
      return store.status
    }
  } catch {
    // ignore corrupt file
  }

  return 'unknown'
}

export function saveMicrophonePreference(status: MicrophonePreference): void {
  if (status === 'unknown') {
    clearMicrophonePreference()
    return
  }

  writeFileSync(preferencePath(), JSON.stringify({ status }, null, 2), 'utf8')
}

export function clearMicrophonePreference(): void {
  const path = preferencePath()
  if (!existsSync(path)) return
  try {
    unlinkSync(path)
  } catch {
    // ignore
  }
}

export function isMicrophoneAllowedByPreference(): boolean {
  return loadMicrophonePreference() === 'granted'
}
