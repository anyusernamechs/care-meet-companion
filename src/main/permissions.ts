import { app, BrowserWindow, dialog, session, shell, systemPreferences } from 'electron'
import { log } from './logger'
import {
  clearMicrophonePreference,
  isMicrophoneAllowedByPreference,
  loadMicrophonePreference,
  saveMicrophonePreference
} from './mic-preferences'
import { getMainWindow } from './app-window'

const MEDIA_PERMISSIONS = new Set(['media', 'display-capture', 'fullscreen', 'pointerLock'])

function wantsAudioOnly(details: unknown): boolean {
  if (!details || typeof details !== 'object') return true
  const mediaTypes = 'mediaTypes' in details && Array.isArray(details.mediaTypes)
    ? details.mediaTypes
    : undefined
  if (!mediaTypes) return true
  const wantsVideo = mediaTypes.includes('video')
  const wantsAudio = mediaTypes.length === 0 || mediaTypes.includes('audio')
  return wantsAudio && !wantsVideo
}

function showMicrophonePermissionDialog(parent: BrowserWindow | undefined): boolean {
  const options = {
    type: 'question' as const,
    buttons: ['Allow microphone', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    title: 'Microphone access',
    message: 'Allow CARE Meet Companion to use your microphone?',
    detail:
      'Your voice is included in recordings. Meeting audio from other participants comes from the Meet tab. You can change this later in Windows microphone settings.'
  }

  const result = parent
    ? dialog.showMessageBoxSync(parent, options)
    : dialog.showMessageBoxSync(options)

  return result === 0
}

function showDisplayCaptureDialog(parent: BrowserWindow | undefined): boolean {
  const options = {
    type: 'question' as const,
    buttons: ['Allow capture', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    title: 'Screen capture',
    message: 'Allow CARE Meet Companion to capture the meeting for recording?',
    detail: 'This records the meeting video shown in the app or the window you selected.'
  }

  const result = parent
    ? dialog.showMessageBoxSync(parent, options)
    : dialog.showMessageBoxSync(options)

  return result === 0
}

export function registerAppPermissions(): void {
  const defaultSession = session.defaultSession

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === 'media' && wantsAudioOnly(details)) {
      if (isMicrophoneAllowedByPreference()) {
        callback(true)
        return
      }

      if (loadMicrophonePreference() === 'denied') {
        callback(false)
        return
      }

      const parent = BrowserWindow.fromWebContents(webContents) ?? getMainWindow() ?? undefined
      const allowed = showMicrophonePermissionDialog(parent)
      if (allowed) {
        saveMicrophonePreference('granted')
      } else {
        saveMicrophonePreference('denied')
      }
      callback(allowed)
      return
    }

    if (permission === 'display-capture') {
      const parent = BrowserWindow.fromWebContents(webContents) ?? getMainWindow() ?? undefined
      callback(showDisplayCaptureDialog(parent))
      return
    }

    callback(MEDIA_PERMISSIONS.has(permission))
  })

  defaultSession.setPermissionCheckHandler((_webContents, permission, _origin, details) => {
    if (permission === 'media') {
      if (!details || wantsAudioOnly(details)) {
        return isMicrophoneAllowedByPreference()
      }
      return false
    }
    return MEDIA_PERMISSIONS.has(permission)
  })
}

export function getMicrophonePermissionStatus(): {
  status: 'granted' | 'denied' | 'unknown'
} {
  const status = loadMicrophonePreference()
  return { status: status === 'unknown' ? 'unknown' : status }
}

export async function initializeMicrophonePermission(): Promise<{
  status: 'granted' | 'denied' | 'warmup'
}> {
  const current = loadMicrophonePreference()
  if (current === 'granted') {
    return { status: 'granted' }
  }
  if (current === 'denied') {
    return { status: 'denied' }
  }

  const parent = getMainWindow() ?? undefined
  const allowed = showMicrophonePermissionDialog(parent)
  if (!allowed) {
    saveMicrophonePreference('denied')
    return { status: 'denied' }
  }

  saveMicrophonePreference('granted')
  return { status: 'warmup' }
}

export function confirmMicrophoneGranted(): void {
  saveMicrophonePreference('granted')
}

export function markMicrophoneDenied(): void {
  saveMicrophonePreference('denied')
}

export async function ensureMicrophoneAccess(): Promise<{ granted: boolean; message?: string }> {
  if (loadMicrophonePreference() === 'denied') {
    return {
      granted: false,
      message:
        'Microphone access was declined. Reset the microphone choice in the app or allow it in Windows settings.'
    }
  }

  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'granted') {
      return { granted: true }
    }

    const granted = await systemPreferences.askForMediaAccess('microphone')
    if (granted) {
      return { granted: true }
    }

    return {
      granted: false,
      message:
        'Microphone access was denied. Open System Settings → Privacy & Security → Microphone and enable CARE Meet Companion.'
    }
  }

  if (process.platform === 'win32') {
    const status = systemPreferences.getMediaAccessStatus('microphone')
    if (status === 'denied') {
      return {
        granted: false,
        message:
          'Microphone access is blocked at the Windows level. Open Settings → Privacy & security → Microphone, turn on access for desktop apps, then try again.'
      }
    }
  }

  return { granted: isMicrophoneAllowedByPreference() || loadMicrophonePreference() !== 'denied' }
}

export async function resetMicrophonePermissions(): Promise<void> {
  clearMicrophonePreference()

  const ses = session.defaultSession
  const origins = app.isPackaged
    ? ['file://']
    : ['http://localhost:5173', 'http://127.0.0.1:5173']

  for (const origin of origins) {
    try {
      await (
        ses as Electron.Session & {
          clearPermission?: (request: { origin: string; permission: string }) => Promise<void>
        }
      ).clearPermission?.({ origin, permission: 'media' })
    } catch (error) {
      log.warn('permissions', `Could not clear microphone permission for ${origin}`, error)
    }
  }
}

export function getAppUserDataPath(): string {
  return app.getPath('userData')
}

export function openMicrophoneSettings(): void {
  if (process.platform === 'win32') {
    void shell.openExternal('ms-settings:privacy-microphone')
    return
  }

  if (process.platform === 'darwin') {
    void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
  }
}
