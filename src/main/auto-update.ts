import { app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getMainWindow } from './app-window'
import { log } from './logger'
import { trustedHandler } from './ipc-guard'
import type { AppUpdateEvent } from '../shared/types'

let updateDownloaded = false

function sendUpdateEvent(payload: AppUpdateEvent): void {
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
    autoUpdater.requestHeaders = { Authorization: `token ${token}` }
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
    sendUpdateEvent({ status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendUpdateEvent({ status: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    sendUpdateEvent({ status: 'not-available', version: app.getVersion() })
  })

  autoUpdater.on('error', (error) => {
    log.error('auto-update', 'Update check failed', error)
    sendUpdateEvent({
      status: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  })

  autoUpdater.on('download-progress', () => {
    sendUpdateEvent({ status: 'downloading' })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true
    sendUpdateEvent({ status: 'downloaded', version: info.version })
  })
}

async function checkForUpdates(): Promise<AppUpdateEvent> {
  if (!app.isPackaged) {
    return { status: 'not-available', version: app.getVersion() }
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    if (result?.updateInfo?.version && result.updateInfo.version !== app.getVersion()) {
      return { status: 'available', version: result.updateInfo.version }
    }
    return { status: 'not-available', version: app.getVersion() }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error('auto-update', 'Manual update check failed', error)
    return { status: 'error', message }
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
    sendUpdateEvent({
      status: updateDownloaded ? 'downloaded' : 'not-available',
      version: app.getVersion()
    })
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

  setTimeout(check, 12_000)
  setInterval(check, 4 * 60 * 60 * 1000)
}
