import { BrowserWindow, app, ipcMain } from 'electron'
import { join } from 'path'
import type { AppConfig } from '../../shared/types'
import type { DriveDestination } from '../../shared/types'
import { log } from '../logger'
import { getAuthorizedClient } from './google-auth'
import { listDriveFolders, listDriveRoots } from './drive-browser'

let pickerWindow: BrowserWindow | null = null
let activeResolve: ((value: DriveDestination | null) => void) | null = null
let pendingConfig: AppConfig | null = null
let ipcRegistered = false

function settlePicker(result: DriveDestination | null): void {
  const resolve = activeResolve
  activeResolve = null
  pendingConfig = null

  if (pickerWindow && !pickerWindow.isDestroyed()) {
    pickerWindow.removeAllListeners('closed')
    pickerWindow.close()
  }
  pickerWindow = null

  resolve?.(result)
}

export function registerDrivePickerIpc(): void {
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.handle('drive-picker:list-roots', async () => {
    if (!pendingConfig) throw new Error('Drive browser is not ready.')
    return listDriveRoots(pendingConfig)
  })

  ipcMain.handle('drive-picker:list-folders', async (_event, parentId: string, driveId?: string) => {
    if (!pendingConfig) throw new Error('Drive browser is not ready.')
    return listDriveFolders(pendingConfig, parentId, driveId)
  })

  ipcMain.on('drive-picker:submit', (_event, payload: DriveDestination) => {
    settlePicker(payload)
  })

  ipcMain.on('drive-picker:cancel', () => {
    settlePicker(null)
  })
}

export async function pickDriveFolder(
  config: AppConfig,
  parentWindow?: BrowserWindow | null
): Promise<DriveDestination | null> {
  await getAuthorizedClient(config)

  if (pickerWindow && !pickerWindow.isDestroyed()) {
    pickerWindow.focus()
    throw new Error('Folder picker is already open.')
  }

  pendingConfig = config

  return new Promise((resolve) => {
    activeResolve = resolve

    pickerWindow = new BrowserWindow({
      width: 1080,
      height: 760,
      minWidth: 900,
      minHeight: 640,
      parent: parentWindow ?? undefined,
      modal: false,
      title: 'Choose a Google Drive folder',
      autoHideMenuBar: true,
      backgroundColor: '#f1f3f4',
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/drive-picker.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    pickerWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      log.info('drive-picker', `[${level}] ${message} (${sourceId}:${line})`)
    })

    pickerWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      log.error('drive-picker', `Failed to load ${url}: ${description} (${code})`)
    })

    pickerWindow.once('ready-to-show', () => {
      pickerWindow?.show()
      if (!app.isPackaged) {
        pickerWindow?.webContents.openDevTools({ mode: 'detach' })
      }
    })

    pickerWindow.on('closed', () => {
      pickerWindow = null
      if (activeResolve) {
        settlePicker(null)
      }
    })

    const pickerUrl = process.env.ELECTRON_RENDERER_URL
      ? `${process.env.ELECTRON_RENDERER_URL}/drive-picker/index.html`
      : null

    if (pickerUrl) {
      void pickerWindow.loadURL(pickerUrl)
    } else {
      void pickerWindow.loadFile(join(__dirname, '../renderer/drive-picker/index.html'))
    }
  })
}
