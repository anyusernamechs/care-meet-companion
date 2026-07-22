import { app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getMainWindow } from './app-window'
import { log } from './logger'
import { trustedHandler } from './ipc-guard'
import { showDesktopNotification } from './tray'
import type { AppUpdateEvent } from '../shared/types'

let updateDownloaded = false
let pendingVersion = ''
let lastEvent: AppUpdateEvent = { status: 'not-available' }
let notifiedAvailable = false
let notifiedDownloaded = false

function sendUpdateEvent(payload: AppUpdateEvent): void {
  lastEvent = payload
  if (payload.version) pendingVersion = payload.version
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.webContents.send('care:app-update', payload)
}

function configureUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  const token = process.env.CARE_GITHUB_UPDATE_TOKEN?.trim()
  if (token) {
    // Required for private GitHub release repos.
    autoUpdater.requestHeaders = { Authorization: `token ${token}` }
    log.info('auto-update', 'GitHub update token configured')
  } else {
    log.warn(
      'auto-update',
      'CARE_GITHUB_UPDATE_TOKEN is not set. Private-repo update checks may fail.'
    )
  }

  autoUpdater.logger = {
    info: (message) => log.info('auto-update', String(message)),
    warn: (message) => log.warn('auto-update', String(message)),
    error: (message) => log.error('auto-update', String(message)),
    debug: (message) => log.info('auto-update', String(message))
  }
}

function registerUpdaterEvents(): void {
  autoUpdater.on('checking-for-update', () => {
    sendUpdateEvent({ status: 'checking', version: app.getVersion() })
  })

  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version
    sendUpdateEvent({ status: 'available', version: info.version })
    if (!notifiedAvailable) {
      notifiedAvailable = true
      showDesktopNotification(
        'Update available',
        `CARE Meet Companion ${info.version} is downloading.`
      )
    }
  })

  autoUpdater.on('update-not-available', () => {
    if (updateDownloaded) {
      sendUpdateEvent({ status: 'downloaded', version: pendingVersion || app.getVersion() })
      return
    }
    sendUpdateEvent({ status: 'not-available', version: app.getVersion() })
  })

  autoUpdater.on('error', (error) => {
    log.error('auto-update', 'Update check failed', error)
    const message = error instanceof Error ? error.message : String(error)
    const signingHint =
      /not digitally signed|not trusted by the trust provider|publisherNames|application owner|SignerCertificate/i.test(
        message
      )
        ? ' Installer signing failed trust checks — ask IT to deploy the CARE signing certificate to Trusted Publishers.'
        : ''
    const privateHint =
      !signingHint &&
      /(?:\b401\b|\b403\b|\b404\b|bad credentials|releases\.atom|private repo|private repository)/i.test(
        message
      ) &&
      !process.env.CARE_GITHUB_UPDATE_TOKEN?.trim()
        ? ' Update feed may be private — ask IT to include CARE_GITHUB_UPDATE_TOKEN in the installer.'
        : ''
    sendUpdateEvent({
      status: 'error',
      version: app.getVersion(),
      message: `${message}${signingHint}${privateHint}`
    })
  })

  autoUpdater.on('download-progress', () => {
    sendUpdateEvent({
      status: 'downloading',
      version: pendingVersion || app.getVersion()
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true
    pendingVersion = info.version
    sendUpdateEvent({ status: 'downloaded', version: info.version })
    if (!notifiedDownloaded) {
      notifiedDownloaded = true
      showDesktopNotification(
        'Update ready',
        `CARE Meet Companion ${info.version} is ready. Restart to install.`
      )
    }
  })
}

async function checkForUpdates(): Promise<AppUpdateEvent> {
  if (!app.isPackaged) {
    const event: AppUpdateEvent = {
      status: 'not-available',
      version: app.getVersion(),
      message: 'Updates are only checked in installed builds.'
    }
    sendUpdateEvent(event)
    return event
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    if (updateDownloaded) {
      const event: AppUpdateEvent = {
        status: 'downloaded',
        version: pendingVersion || result?.updateInfo?.version || app.getVersion()
      }
      sendUpdateEvent(event)
      return event
    }
    if (result?.updateInfo?.version && result.updateInfo.version !== app.getVersion()) {
      const event: AppUpdateEvent = { status: 'available', version: result.updateInfo.version }
      sendUpdateEvent(event)
      return event
    }
    const event: AppUpdateEvent = { status: 'not-available', version: app.getVersion() }
    sendUpdateEvent(event)
    return event
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('auto-update', 'Manual update check failed', error)
    const event: AppUpdateEvent = { status: 'error', version: app.getVersion(), message }
    sendUpdateEvent(event)
    return event
  }
}

export function registerAutoUpdateHandlers(): void {
  ipcMain.handle('care:get-app-version', trustedHandler(async () => app.getVersion()))

  ipcMain.handle('care:check-for-updates', trustedHandler(async () => checkForUpdates()))

  ipcMain.handle(
    'care:install-app-update',
    trustedHandler(async () => {
      if (!app.isPackaged || !updateDownloaded) {
        return { installed: false }
      }
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true)
      })
      return { installed: true }
    })
  )

  ipcMain.on('care:subscribe-app-update', (event) => {
    const window = getMainWindow()
    if (!window || event.sender !== window.webContents) return
    event.sender.send('care:app-update', lastEvent)
  })
}

export function initAutoUpdates(): void {
  if (!app.isPackaged) return

  configureUpdater()
  registerUpdaterEvents()

  const check = (): void => {
    void autoUpdater.checkForUpdates().catch((error) => {
      log.warn('auto-update', 'Background update check failed', error)
    })
  }

  // First check soon after launch so users see the banner quickly.
  setTimeout(check, 5_000)
  setInterval(check, 4 * 60 * 60 * 1000)
}
