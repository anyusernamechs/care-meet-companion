import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, powerSaveBlocker, shell } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { mkdirSync, statfsSync } from 'fs'
import { join } from 'path'
import { setMainWindow, getMainWindow } from './app-window'
import { getAppIconPath } from './branding'
import { loadConfig } from './config'
import { trustedHandler } from './ipc-guard'
import { log } from './logger'
import { registerSession } from './session-registry'
import {
  configureMeetTabCapture,
  prepareCapture,
  registerDisplayMediaHandler,
  setCaptureMode,
  setSelectedCaptureSource
} from './capture'
import { getMeetCaptionStatus, startMeetCaptionCapture } from './meet-captions'
import { startMeetSpeakerCapture } from './meet-speakers'
import { markMeetCallActive, onMeetCallEnded, resetMeetCallMonitor } from './meet-session-monitor'
import {
  applySidebarLayout,
  closeMeetView,
  getMeetStatus,
  getMeetAccountEmail,
  installMeetWindowHandlers,
  isSidebarExpanded,
  openMeetInBrowser,
  openMeetUrl
} from './meet-view'
import { getRecordingsRoot, resolveSessionFolderName } from './paths'
import {
  confirmMicrophoneGranted,
  ensureMicrophoneAccess,
  getMicrophonePermissionStatus,
  initializeMicrophonePermission,
  markMicrophoneDenied,
  openMicrophoneSettings,
  resetMicrophonePermissions
} from './permissions'
import { setRecordingActive } from './recording-state'
import { isLongTaskActive, setLongTaskActiveFlag } from './long-task'
import {
  hideMainWindow,
  installWindowTrayBehavior,
  setTrayTooltip,
  showDesktopNotification,
  showMainWindow
} from './tray'
import { listCalendarMeetings, getCurrentOrNextMeeting } from './services/calendar'
import { pickDriveFolder, registerDrivePickerIpc } from './services/drive-picker-window'
import {
  isRecordingsDirectoryLocked,
  saveRecordingsDirectory
} from './services/recordings-settings'
import {
  clearDriveDestination,
  loadDriveDestination,
  saveDriveDestination
} from './services/drive-settings'
import { establishFolderAccess, getAuthStatus, signOutGoogle, startGoogleAuth } from './services/drive'
import { appendChunk, beginNotesSession, beginSession, processRecording } from './services/pipeline'
import type { CaptureMode, CaptureSource, MeetCallEndedEvent, SessionMode } from '../shared/types'
import { assertTrustedRenderer } from './ipc-guard'

const progressCallbacks = new Set<(message: string) => void>()
const meetEndedCallbacks = new Set<(event: MeetCallEndedEvent) => void>()
const sidebarCallbacks = new Set<(expanded: boolean) => void>()
let powerBlockerId: number | null = null

function setLongTaskActive(active: boolean): void {
  setLongTaskActiveFlag(active)
  if (active && powerBlockerId === null) {
    powerBlockerId = powerSaveBlocker.start('prevent-app-suspension')
    setTrayTooltip('CARE Meet Companion — working…')
  } else if (!active && powerBlockerId !== null) {
    if (powerSaveBlocker.isStarted(powerBlockerId)) powerSaveBlocker.stop(powerBlockerId)
    powerBlockerId = null
    setTrayTooltip('CARE Meet Companion')
  }
}

function getWindowIcon() {
  const image = nativeImage.createFromPath(getAppIconPath())
  return image.isEmpty() ? undefined : image
}

function notifySidebarChanged(expanded: boolean): void {
  const mainWindow = getMainWindow()
  for (const callback of sidebarCallbacks) {
    callback(expanded)
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('care:sidebar-changed', { expanded })
  }
}

function toggleSidebar(): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) return
  applySidebarLayout(mainWindow, !isSidebarExpanded())
  notifySidebarChanged(isSidebarExpanded())
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 760,
    height: 820,
    minWidth: 640,
    minHeight: 640,
    title: 'CARE Meet Companion',
    icon: getWindowIcon(),
    backgroundColor: '#f4f5f7',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  setMainWindow(window)

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  installMeetWindowHandlers(window)
  installWindowTrayBehavior(window)

  window.on('closed', () => {
    setMainWindow(null)
  })

  return window
}

export function registerIpcHandlers(): void {
  registerDrivePickerIpc()
  registerDisplayMediaHandler()

  onMeetCallEnded((reason) => {
    const event: MeetCallEndedEvent = { reason }
    for (const callback of meetEndedCallbacks) {
      callback(event)
    }
  })

  ipcMain.handle(
    'care:get-config',
    trustedHandler(() => {
      const config = loadConfig()
      return {
        recordingsDir: config.recordingsDir,
        recordingsDirLocked: isRecordingsDirectoryLocked(),
        whisperEnabled: config.whisperEnabled,
        transcriptionReady: config.bundledToolsReady,
        driveFolderId: config.driveFolderId,
        driveFolderLabel: config.driveFolderLabel
      }
    })
  )

  ipcMain.handle(
    'care:get-storage-status',
    trustedHandler(() => {
      const path = loadConfig().recordingsDir
      mkdirSync(path, { recursive: true })
      const stats = statfsSync(path)
      return {
        availableBytes: stats.bavail * stats.bsize,
        totalBytes: stats.blocks * stats.bsize,
        path
      }
    })
  )

  ipcMain.handle(
    'care:get-capture-sources',
    trustedHandler(async (): Promise<CaptureSource[]> => {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      })

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon?.toDataURL(),
        displayId: source.display_id
      }))
    })
  )

  ipcMain.handle(
    'care:prepare-capture',
    trustedHandler(() => {
      const mainWindow = getMainWindow()
      if (!mainWindow) {
        return { ready: false, message: 'Application window is not ready.' }
      }
      return prepareCapture(mainWindow)
    })
  )

  ipcMain.handle('care:ensure-microphone-access', trustedHandler(async () => ensureMicrophoneAccess()))
  ipcMain.handle(
    'care:get-microphone-permission-status',
    trustedHandler(() => getMicrophonePermissionStatus())
  )
  ipcMain.handle(
    'care:initialize-microphone',
    trustedHandler(async () => initializeMicrophonePermission())
  )
  ipcMain.handle('care:confirm-microphone-granted', trustedHandler(() => {
    confirmMicrophoneGranted()
  }))
  ipcMain.handle('care:mark-microphone-denied', trustedHandler(() => {
    markMicrophoneDenied()
  }))
  ipcMain.handle('care:open-microphone-settings', trustedHandler(() => openMicrophoneSettings()))
  ipcMain.handle(
    'care:reset-microphone-permissions',
    trustedHandler(async () => resetMicrophonePermissions())
  )

  ipcMain.handle(
    'care:set-capture-mode',
    trustedHandler((_event, mode: CaptureMode) => {
      setCaptureMode(mode)
    })
  )

  ipcMain.handle(
    'care:set-capture-source',
    trustedHandler((_event, sourceId: string) => {
      if (!sourceId || sourceId.length > 256) {
        throw new Error('Invalid capture source.')
      }
      setSelectedCaptureSource(sourceId)
    })
  )

  ipcMain.handle(
    'care:configure-meet-tab-capture',
    trustedHandler((_event, options: { includeAudio?: boolean }) => {
      configureMeetTabCapture(options)
    })
  )

  ipcMain.handle(
    'care:open-meet',
    trustedHandler((_event, url: string) => {
      const mainWindow = getMainWindow()
      if (!mainWindow) return getMeetStatus()
      openMeetUrl(mainWindow, url)
      return getMeetStatus()
    })
  )

  ipcMain.handle(
    'care:open-meet-browser',
    trustedHandler((_event, url: string) => {
      openMeetInBrowser(url)
    })
  )

  ipcMain.handle('care:get-meet-status', trustedHandler(() => getMeetStatus()))
  ipcMain.handle(
    'care:close-meet',
    trustedHandler(() => {
      const mainWindow = getMainWindow()
      if (mainWindow) closeMeetView(mainWindow)
    })
  )
  ipcMain.handle('care:get-meet-account-email', trustedHandler(() => getMeetAccountEmail()))
  ipcMain.handle('care:get-meet-caption-status', trustedHandler(() => getMeetCaptionStatus()))
  ipcMain.handle('care:get-sidebar-expanded', trustedHandler(() => isSidebarExpanded()))

  ipcMain.handle(
    'care:set-sidebar-expanded',
    trustedHandler((_event, expanded: boolean) => {
      const mainWindow = getMainWindow()
      if (!mainWindow || mainWindow.isDestroyed()) {
        return isSidebarExpanded()
      }
      applySidebarLayout(mainWindow, expanded)
      notifySidebarChanged(expanded)
      return isSidebarExpanded()
    })
  )

  ipcMain.handle(
    'care:toggle-sidebar',
    trustedHandler(() => {
      toggleSidebar()
      return isSidebarExpanded()
    })
  )

  ipcMain.handle(
    'care:start-google-auth',
    trustedHandler(() => startGoogleAuth(loadConfig(), getMainWindow()))
  )

  ipcMain.handle('care:get-auth-status', trustedHandler(() => getAuthStatus(loadConfig())))
  ipcMain.handle(
    'care:sign-out-google',
    trustedHandler(async () => {
      await signOutGoogle(loadConfig())
      clearDriveDestination()
    })
  )
  ipcMain.handle('care:get-drive-destination', trustedHandler(() => loadDriveDestination()))

  ipcMain.handle(
    'care:set-drive-destination',
    trustedHandler(async (_event, destination) => {
      const config = {
        ...loadConfig(),
        driveFolderId: destination.folderId,
        driveFolderLabel: destination.pathLabel,
        driveId: destination.driveId
      }
      if (destination.folderId) {
        await establishFolderAccess(config, destination.folderId)
      }
      saveDriveDestination(destination)
      return loadDriveDestination()
    })
  )

  ipcMain.handle('care:clear-drive-destination', trustedHandler(() => clearDriveDestination()))

  ipcMain.handle(
    'care:pick-drive-folder',
    trustedHandler(async () => {
      try {
        return await pickDriveFolder(loadConfig(), getMainWindow())
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(message)
      }
    })
  )

  ipcMain.handle(
    'care:get-calendar-meetings',
    trustedHandler(async () => {
      try {
        return await listCalendarMeetings(loadConfig())
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Could not load your calendar: ${message}`)
      }
    })
  )

  ipcMain.handle(
    'care:get-current-meeting',
    trustedHandler(async () => {
      try {
        return await getCurrentOrNextMeeting(loadConfig())
      } catch {
        return null
      }
    })
  )

  ipcMain.handle(
    'care:begin-recording-session',
    trustedHandler((_event, payload: { title: string; startedAt: string; mode?: SessionMode }) => {
      const config = loadConfig()
      const folderName = resolveSessionFolderName(
        payload.title,
        payload.startedAt,
        getRecordingsRoot(config)
      )

      registerSession(folderName)
      resetMeetCallMonitor()
      markMeetCallActive()

      const notesOnly = payload.mode === 'notes-only'
      const folderPath = notesOnly
        ? beginNotesSession(folderName, config)
        : beginSession(folderName, config)

      // Live Meet CC is only needed for notes-only.
      // Video recordings track active speakers from video-tile dots + Whisper.
      if (notesOnly) {
        void startMeetCaptionCapture(folderName, folderPath)
      } else {
        void startMeetSpeakerCapture(folderName, folderPath, payload.startedAt)
      }

      return { folderName, folderPath }
    })
  )

  ipcMain.handle(
    'care:set-recording-active',
    trustedHandler((_event, active: boolean) => {
      const isActive = Boolean(active)
      setRecordingActive(isActive)
      setLongTaskActive(isActive)
    })
  )

  ipcMain.handle(
    'care:save-recording-chunk',
    trustedHandler(async (_event, sessionId: string, chunk: ArrayBuffer | Buffer, isFinal: boolean) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      await appendChunk(sessionId, data, isFinal)
    })
  )

  ipcMain.handle(
    'care:start-processing',
    trustedHandler(async (_event, payload) => {
      resetMeetCallMonitor()
      setRecordingActive(false)
      setLongTaskActive(true)
      try {
        const result = await processRecording(payload, (message) => {
          setTrayTooltip(`CARE Meet Companion — ${message}`)
          for (const callback of progressCallbacks) callback(message)
        })
        const hidden = (() => {
          const mainWindow = getMainWindow()
          return Boolean(mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible())
        })()
        showDesktopNotification(
          'Recording ready',
          result.message || 'Your recording finished saving and uploading.'
        )
        if (hidden) showMainWindow()
        return result
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        showDesktopNotification('Could not finish saving', message)
        showMainWindow()
        throw error
      } finally {
        setLongTaskActive(false)
      }
    })
  )

  ipcMain.handle(
    'care:hide-to-tray',
    trustedHandler(async () => {
      if (!isLongTaskActive()) {
        return { hidden: false, reason: 'No background task is running.' }
      }
      hideMainWindow()
      setTrayTooltip('CARE Meet Companion — uploading in background')
      showDesktopNotification(
        'Working in the background',
        'Saving and Google Drive upload continue in the tray. You’ll get a notification when it’s done.'
      )
      return { hidden: true }
    })
  )

  ipcMain.handle(
    'care:show-window',
    trustedHandler(async () => {
      showMainWindow()
    })
  )

  ipcMain.handle(
    'care:choose-recordings-dir',
    trustedHandler(async () => {
      if (isRecordingsDirectoryLocked()) {
        throw new Error('Your recordings folder is set by IT and cannot be changed in the app.')
      }

      const config = loadConfig()
      const mainWindow = getMainWindow()
      const dialogOptions: OpenDialogOptions = {
        title: 'Choose local recordings folder',
        defaultPath: config.recordingsDir,
        properties: ['openDirectory', 'createDirectory']
      }

      const result =
        mainWindow && !mainWindow.isDestroyed()
          ? await dialog.showOpenDialog(mainWindow, dialogOptions)
          : await dialog.showOpenDialog(dialogOptions)

      if (result.canceled || !result.filePaths[0]) {
        return null
      }

      const chosen = result.filePaths[0]
      mkdirSync(chosen, { recursive: true })
      saveRecordingsDirectory(chosen)
      return chosen
    })
  )

  ipcMain.on('care:open-recordings-folder', (event) => {
    assertTrustedRenderer(event)
    shell.openPath(loadConfig().recordingsDir)
  })

  ipcMain.on('care:subscribe-progress', (event) => {
    assertTrustedRenderer(event)
    const sender = event.sender
    const listener = (message: string) => {
      if (!sender.isDestroyed()) {
        sender.send('care:processing-progress', message)
      }
    }
    progressCallbacks.add(listener)
    sender.once('destroyed', () => {
      progressCallbacks.delete(listener)
    })
  })

  ipcMain.on('care:subscribe-meet-events', (event) => {
    assertTrustedRenderer(event)
    const sender = event.sender
    const listener = (payload: MeetCallEndedEvent) => {
      if (!sender.isDestroyed()) {
        sender.send('care:meet-call-ended', payload)
      }
    }
    meetEndedCallbacks.add(listener)
    sender.once('destroyed', () => {
      meetEndedCallbacks.delete(listener)
    })
  })

  ipcMain.on('care:subscribe-sidebar', (event) => {
    assertTrustedRenderer(event)
    const sender = event.sender
    const listener = (expanded: boolean) => {
      if (!sender.isDestroyed()) {
        sender.send('care:sidebar-changed', { expanded })
      }
    }
    sidebarCallbacks.add(listener)
    sender.once('destroyed', () => {
      sidebarCallbacks.delete(listener)
    })
  })

  globalShortcut.register('Alt+Shift+M', () => {
    toggleSidebar()
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
}

export { getMainWindow } from './app-window'
