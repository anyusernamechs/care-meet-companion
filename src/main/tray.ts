import { Menu, Notification, Tray, app, dialog, nativeImage } from 'electron'
import { getAppIconPath } from './branding'
import { getMainWindow } from './app-window'
import { isLongTaskActive } from './long-task'
import { isRecordingActive } from './recording-state'

let tray: Tray | null = null
let quitting = false

export function isAppQuitting(): boolean {
  return quitting
}

export function requestAppQuit(): void {
  quitting = true
  destroyTray()
  app.quit()
}

function trayIcon(): Electron.NativeImage {
  const image = nativeImage.createFromPath(getAppIconPath())
  if (image.isEmpty()) {
    return nativeImage.createEmpty()
  }
  return process.platform === 'win32' ? image : image.resize({ width: 16, height: 16 })
}

export function showMainWindow(): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

export function hideMainWindow(): void {
  const window = getMainWindow()
  if (!window || window.isDestroyed()) return
  window.hide()
}

export function createAppTray(): Tray {
  if (tray) return tray

  tray = new Tray(trayIcon())
  tray.setToolTip('CARE Meet Companion')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Show CARE Meet Companion',
        click: () => showMainWindow()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          if ((isRecordingActive() || isLongTaskActive()) && !confirmQuitWhileBusy()) {
            return
          }
          requestAppQuit()
        }
      }
    ])
  )

  tray.on('double-click', () => showMainWindow())
  tray.on('click', () => {
    if (process.platform === 'win32') showMainWindow()
  })

  return tray
}

function confirmQuitWhileBusy(): boolean {
  const window = getMainWindow()
  const options = {
    type: 'warning' as const,
    buttons: ['Keep working', 'Quit anyway'],
    defaultId: 0,
    cancelId: 0,
    title: 'Work in progress',
    message: 'A recording or upload is still running.',
    detail: 'Quitting now may interrupt saving or Google Drive upload.'
  }
  return window && !window.isDestroyed()
    ? dialog.showMessageBoxSync(window, options) === 1
    : dialog.showMessageBoxSync(options) === 1
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

export function setTrayTooltip(text: string): void {
  tray?.setToolTip(text)
}

export function showDesktopNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title,
    body,
    icon: getAppIconPath(),
    silent: false
  })
  notification.on('click', () => showMainWindow())
  notification.show()
}

export function installWindowTrayBehavior(window: Electron.BrowserWindow): void {
  createAppTray()

  window.on('close', (event) => {
    if (quitting) return

    if (isRecordingActive()) {
      event.preventDefault()
      showDesktopNotification(
        'Recording in progress',
        'Stop the recording before closing CARE Meet Companion.'
      )
      showMainWindow()
      return
    }

    if (isLongTaskActive()) {
      event.preventDefault()
      hideMainWindow()
      setTrayTooltip('CARE Meet Companion — uploading in background')
      showDesktopNotification(
        'Working in the background',
        'Saving and uploading continue in the system tray. You’ll get a notification when it’s done.'
      )
      return
    }

    requestAppQuit()
  })
}
