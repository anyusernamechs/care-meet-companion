import { app, BrowserWindow, desktopCapturer, globalShortcut, ipcMain, nativeImage, shell } from 'electron'
import { join } from 'path'
import { getAppIconPath } from './branding'
import { loadConfig } from './config'
import { appendChunk, beginNotesSession, beginSession, processRecording } from './services/pipeline'
import { getRecordingsRoot, resolveSessionFolderName } from './paths'
import { getAuthStatus, startGoogleAuth } from './services/drive'
import { listDriveFolders, listDriveRoots } from './services/drive-browser'
import {
  clearDriveDestination,
  loadDriveDestination,
  saveDriveDestination
} from './services/drive-settings'
import { getCurrentOrNextMeeting, listCalendarMeetings } from './services/calendar'
import {
  configureMeetTabCapture,
  prepareCapture,
  registerDisplayMediaHandler,
  setCaptureMode,
  setSelectedCaptureSource
} from './capture'
import { setRecordingActive } from './recording-state'
import {
  applySidebarLayout,
  ensureMeetView,
  getMeetStatus,
  installMeetWindowHandlers,
  isSidebarExpanded,
  openMeetInBrowser,
  openMeetUrl,
  PANEL_SEPARATOR,
  SIDEBAR_WIDTH
} from './meet-view'
import { getCaptureMode } from './capture'
import { getMeetCaptionStatus, startMeetCaptionCapture } from './meet-captions'
import { markMeetCallActive, onMeetCallEnded, resetMeetCallMonitor } from './meet-session-monitor'
import { ensureMicrophoneAccess, openMicrophoneSettings, resetMicrophonePermissions } from './permissions'
import type { CaptureMode, CaptureSource, MeetCallEndedEvent, SessionMode } from '../shared/types'

let mainWindow: BrowserWindow | null = null
const progressCallbacks = new Set<(message: string) => void>()
const meetEndedCallbacks = new Set<(event: MeetCallEndedEvent) => void>()

const sidebarCallbacks = new Set<(expanded: boolean) => void>()

function getWindowIcon() {
  const image = nativeImage.createFromPath(getAppIconPath())
  return image.isEmpty() ? undefined : image
}

function notifySidebarChanged(expanded: boolean): void {
  for (const callback of sidebarCallbacks) {
    callback(expanded)
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('care:sidebar-changed', { expanded })
  }
}

function toggleSidebar(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  applySidebarLayout(mainWindow, !isSidebarExpanded())
  notifySidebarChanged(isSidebarExpanded())
}

export function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: SIDEBAR_WIDTH + PANEL_SEPARATOR + 640,
    minHeight: 640,
    title: 'CARE Meet Companion',
    icon: getWindowIcon(),
    backgroundColor: '#8e9cb0',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  installMeetWindowHandlers(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  ensureMeetView(mainWindow)

  return mainWindow
}

export function registerIpcHandlers(): void {
  registerDisplayMediaHandler()

  onMeetCallEnded((reason) => {
    const event: MeetCallEndedEvent = { reason }
    for (const callback of meetEndedCallbacks) {
      callback(event)
    }
  })

  ipcMain.handle('care:get-config', () => {
    const config = loadConfig()
    return {
      recordingsDir: config.recordingsDir,
      whisperEnabled: config.whisperEnabled,
      transcriptionReady: config.bundledToolsReady,
      driveFolderId: config.driveFolderId,
      driveFolderLabel: config.driveFolderLabel
    }
  })

  ipcMain.handle('care:get-capture-sources', async (): Promise<CaptureSource[]> => {
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

  ipcMain.handle('care:prepare-capture', () => {
    if (!mainWindow) {
      return { ready: false, message: 'Application window is not ready.' }
    }
    return prepareCapture(mainWindow)
  })

  ipcMain.handle('care:ensure-microphone-access', async () => ensureMicrophoneAccess())

  ipcMain.handle('care:open-microphone-settings', () => {
    openMicrophoneSettings()
  })

  ipcMain.handle('care:reset-microphone-permissions', async () => {
    await resetMicrophonePermissions()
  })

  ipcMain.handle('care:set-capture-mode', (_event, mode: CaptureMode) => {
    setCaptureMode(mode)
  })

  ipcMain.handle('care:set-capture-source', (_event, sourceId: string) => {
    setSelectedCaptureSource(sourceId)
  })

  ipcMain.handle(
    'care:configure-meet-tab-capture',
    (
      _event,
      options: {
        includeAudio?: boolean
      }
    ) => {
      configureMeetTabCapture(options)
    }
  )

  ipcMain.handle('care:open-meet', (_event, url: string) => {
    if (!mainWindow) return getMeetStatus()
    openMeetUrl(mainWindow, url)
    return getMeetStatus()
  })

  ipcMain.handle('care:open-meet-browser', (_event, url: string) => {
    openMeetInBrowser(url)
  })

  ipcMain.handle('care:get-meet-status', () => getMeetStatus())

  ipcMain.handle('care:get-meet-caption-status', () => getMeetCaptionStatus())

  ipcMain.handle('care:get-sidebar-expanded', () => isSidebarExpanded())

  ipcMain.handle('care:set-sidebar-expanded', (_event, expanded: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return isSidebarExpanded()
    }
    applySidebarLayout(mainWindow, expanded)
    notifySidebarChanged(expanded)
    return isSidebarExpanded()
  })

  ipcMain.handle('care:toggle-sidebar', () => {
    toggleSidebar()
    return isSidebarExpanded()
  })

  ipcMain.handle('care:start-google-auth', () => startGoogleAuth(loadConfig(), mainWindow))
  ipcMain.handle('care:get-auth-status', () => getAuthStatus(loadConfig()))

  ipcMain.handle('care:get-drive-destination', () => loadDriveDestination())

  ipcMain.handle('care:set-drive-destination', (_event, destination) => {
    saveDriveDestination(destination)
    return loadDriveDestination()
  })

  ipcMain.handle('care:clear-drive-destination', () => {
    clearDriveDestination()
  })

  ipcMain.handle('care:list-drive-roots', async () => {
    try {
      return await listDriveRoots(loadConfig())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Could not load Google Drive locations: ${message}`)
    }
  })

  ipcMain.handle('care:list-drive-folders', async (_event, parentId: string, driveId?: string) => {
    try {
      return await listDriveFolders(loadConfig(), parentId, driveId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Could not load folders: ${message}`)
    }
  })

  ipcMain.handle('care:get-calendar-meetings', async () => {
    try {
      return await listCalendarMeetings(loadConfig())
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Could not load your calendar: ${message}`)
    }
  })

  ipcMain.handle('care:get-current-meeting', async () => {
    try {
      return await getCurrentOrNextMeeting(loadConfig())
    } catch {
      return null
    }
  })

  ipcMain.handle(
    'care:begin-recording-session',
    (_event, payload: { title: string; startedAt: string; mode?: SessionMode }) => {
      const config = loadConfig()
      const folderName = resolveSessionFolderName(
        payload.title,
        payload.startedAt,
        getRecordingsRoot(config)
      )

      resetMeetCallMonitor()
      markMeetCallActive()

      const notesOnly = payload.mode === 'notes-only'
      const folderPath = notesOnly
        ? beginNotesSession(folderName, config)
        : beginSession(folderName, config)

      if (notesOnly || getCaptureMode() === 'meet-tab') {
        void startMeetCaptionCapture(folderName, folderPath)
      }

      return { folderName, folderPath }
    }
  )

  ipcMain.handle('care:set-recording-active', (_event, active: boolean) => {
    setRecordingActive(Boolean(active))
  })

  ipcMain.handle(
    'care:save-recording-chunk',
    async (_event, sessionId: string, chunk: ArrayBuffer | Buffer, isFinal: boolean) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      await appendChunk(sessionId, data, isFinal)
    }
  )

  ipcMain.handle(
    'care:start-processing',
    async (
      _event,
      payload: {
        sessionId: string
        title: string
        startedAt: string
        mode?: SessionMode
        hostEmail?: string
        calendarEventId?: string
        hangoutLink?: string
        meetingCode?: string
      }
    ) => {
      resetMeetCallMonitor()
      setRecordingActive(false)
      return processRecording(payload, (message) => {
        for (const callback of progressCallbacks) {
          callback(message)
        }
      })
    }
  )

  ipcMain.on('care:open-recordings-folder', () => {
    shell.openPath(loadConfig().recordingsDir)
  })

  ipcMain.on('care:subscribe-progress', (event) => {
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

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
