import { BrowserView, BrowserWindow, session, shell } from 'electron'
import { installMeetNavigationMonitor } from './meet-session-monitor'
import { isRecordingActive } from './recording-state'

export const SIDEBAR_WIDTH = 400
export const FOCUS_RAIL_WIDTH = 44
export const PANEL_SEPARATOR = 5

export const GOOGLE_SESSION_PARTITION = 'persist:care-meet'

const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const MIN_MEET_WIDTH = 480

let meetView: BrowserView | null = null
let sidebarExpanded = true
let layoutTimer: ReturnType<typeof setTimeout> | null = null
let windowHandlersInstalled = false

function configureMeetSession(): void {
  const meetSession = session.fromPartition(GOOGLE_SESSION_PARTITION)

  meetSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'fullscreen', 'pointerLock'].includes(permission)
    callback(allowed)
  })

  meetSession.setPermissionCheckHandler((_webContents, permission) => {
    return ['media', 'display-capture', 'fullscreen', 'pointerLock'].includes(permission)
  })
}

export function getSidebarOffset(): number {
  return sidebarExpanded ? SIDEBAR_WIDTH : FOCUS_RAIL_WIDTH
}

export function isSidebarExpanded(): boolean {
  return sidebarExpanded
}

export function setSidebarExpanded(expanded: boolean): boolean {
  sidebarExpanded = expanded
  return sidebarExpanded
}

export function getMeetView(): BrowserView | null {
  if (meetView?.webContents.isDestroyed()) {
    meetView = null
  }
  return meetView
}

function attachMeetView(mainWindow: BrowserWindow): void {
  const view = getMeetView()
  if (!view || mainWindow.isDestroyed()) return
  if (mainWindow.getBrowserView() !== view) {
    mainWindow.setBrowserView(view)
  }
}

function detachMeetView(mainWindow: BrowserWindow): void {
  if (mainWindow.isDestroyed()) return
  if (mainWindow.getBrowserView()) {
    mainWindow.setBrowserView(null)
  }
}

export function layoutMeetView(mainWindow: BrowserWindow): void {
  const view = getMeetView()
  if (!view || mainWindow.isDestroyed()) return

  if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
    return
  }

  const [width, height] = mainWindow.getContentSize()
  const offset = getSidebarOffset()
  const separator = PANEL_SEPARATOR
  const meetWidth = Math.max(width - offset - separator, MIN_MEET_WIDTH)

  view.setBounds({
    x: offset + separator,
    y: 0,
    width: meetWidth,
    height: Math.max(height, 1)
  })

  view.setAutoResize({
    width: true,
    height: true,
    horizontal: false,
    vertical: false
  })
}

export function scheduleMeetLayout(mainWindow: BrowserWindow): void {
  if (layoutTimer) {
    clearTimeout(layoutTimer)
  }
  layoutTimer = setTimeout(() => {
    layoutTimer = null
    layoutMeetView(mainWindow)
  }, 32)
}

export function installMeetWindowHandlers(mainWindow: BrowserWindow): void {
  if (windowHandlersInstalled) return
  windowHandlersInstalled = true

  const relayout = () => scheduleMeetLayout(mainWindow)

  mainWindow.on('resize', relayout)
  mainWindow.on('resized', relayout)
  mainWindow.on('maximize', relayout)
  mainWindow.on('unmaximize', relayout)
  mainWindow.on('enter-full-screen', relayout)
  mainWindow.on('leave-full-screen', relayout)
  mainWindow.on('move', relayout)

  mainWindow.on('minimize', () => {
    // Detaching the Meet view ends BrowserView capture tracks and empties recordings.
    if (!isRecordingActive()) {
      detachMeetView(mainWindow)
    }
  })

  mainWindow.on('restore', () => {
    attachMeetView(mainWindow)
    scheduleMeetLayout(mainWindow)
  })

  mainWindow.on('show', () => {
    attachMeetView(mainWindow)
    scheduleMeetLayout(mainWindow)
  })

  mainWindow.on('focus', () => {
    scheduleMeetLayout(mainWindow)
  })
}

export function ensureMeetView(mainWindow: BrowserWindow): BrowserView {
  configureMeetSession()

  if (meetView && !meetView.webContents.isDestroyed()) {
    attachMeetView(mainWindow)
    layoutMeetView(mainWindow)
    return meetView
  }

  meetView = new BrowserView({
    webPreferences: {
      partition: GOOGLE_SESSION_PARTITION,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  meetView.webContents.setUserAgent(CHROME_USER_AGENT)
  meetView.webContents.setAudioMuted(false)
  installMeetNavigationMonitor(meetView.webContents)
  attachMeetView(mainWindow)
  layoutMeetView(mainWindow)

  void meetView.webContents.loadURL('https://meet.google.com')

  return meetView
}

export function applySidebarLayout(mainWindow: BrowserWindow, expanded: boolean): void {
  setSidebarExpanded(expanded)
  mainWindow.setMinimumSize(
    expanded ? SIDEBAR_WIDTH + MIN_MEET_WIDTH : FOCUS_RAIL_WIDTH + MIN_MEET_WIDTH,
    640
  )
  attachMeetView(mainWindow)
  layoutMeetView(mainWindow)
}

export function openMeetUrl(mainWindow: BrowserWindow, url: string): void {
  const view = ensureMeetView(mainWindow)
  const target = url.trim() || 'https://meet.google.com'
  void view.webContents.loadURL(target)
}

export function openMeetInBrowser(url: string): void {
  void shell.openExternal(url.trim() || 'https://meet.google.com')
}

export function prepareMeetForRecording(mainWindow: BrowserWindow): boolean {
  const view = getMeetView()
  if (!view || view.webContents.isDestroyed()) {
    return false
  }

  attachMeetView(mainWindow)
  layoutMeetView(mainWindow)
  mainWindow.focus()
  view.webContents.focus()
  return !view.webContents.isLoading()
}

export function getMeetStatus(): { open: boolean; url: string; title: string; ready: boolean } {
  const view = getMeetView()
  if (!view) {
    return { open: false, url: '', title: '', ready: false }
  }

  return {
    open: true,
    url: view.webContents.getURL(),
    title: view.webContents.getTitle(),
    ready: !view.webContents.isLoading()
  }
}
