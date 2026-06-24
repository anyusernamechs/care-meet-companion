import { app, BrowserWindow, dialog, session, shell, systemPreferences } from 'electron'

const MEDIA_PERMISSIONS = new Set(['media', 'display-capture', 'fullscreen', 'pointerLock'])

function showMicrophonePermissionDialog(parent: BrowserWindow | undefined): boolean {
  const options = {
    type: 'question' as const,
    buttons: ['Allow microphone', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    title: 'Microphone access',
    message: 'Allow CARE Meet Companion to use your microphone?',
    detail:
      'Your voice is recorded from the microphone. Other participants are captured from meeting audio. You can change this later in Windows microphone settings.'
  }

  const result = parent
    ? dialog.showMessageBoxSync(parent, options)
    : dialog.showMessageBoxSync(options)

  return result === 0
}

export function registerAppPermissions(): void {
  const defaultSession = session.defaultSession

  defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (permission === 'media') {
      const mediaTypes =
        'mediaTypes' in details && Array.isArray(details.mediaTypes) ? details.mediaTypes : []
      const wantsVideo = mediaTypes.includes('video')
      const wantsAudio = mediaTypes.length === 0 || mediaTypes.includes('audio')

      if (wantsVideo && !wantsAudio) {
        callback(false)
        return
      }

      const parent = BrowserWindow.fromWebContents(webContents) ?? undefined
      callback(showMicrophonePermissionDialog(parent))
      return
    }

    if (permission === 'display-capture') {
      callback(true)
      return
    }

    callback(MEDIA_PERMISSIONS.has(permission))
  })

  // Return false for media so the request handler (and our dialog) always runs.
  defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') {
      return false
    }
    return MEDIA_PERMISSIONS.has(permission)
  })
}

export async function ensureMicrophoneAccess(): Promise<{ granted: boolean; message?: string }> {
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

  return { granted: true }
}

export async function resetMicrophonePermissions(): Promise<void> {
  await session.defaultSession.clearStorageData()
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
