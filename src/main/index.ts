import { app, BrowserWindow } from 'electron'
import { bootstrapEnv } from './env'
import { createMainWindow, registerIpcHandlers } from './ipc'
import { registerAppPermissions } from './permissions'
import { initAutoUpdates, registerAutoUpdateHandlers } from './auto-update'
import { isAppQuitting, showMainWindow } from './tray'

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')

if (process.platform === 'win32') {
  app.setAppUserModelId('org.care.meet-companion')
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.whenReady().then(() => {
    bootstrapEnv()
    registerAppPermissions()
    registerIpcHandlers()
    registerAutoUpdateHandlers()
    createMainWindow()
    initAutoUpdates()

    app.on('activate', () => {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length === 0) {
        createMainWindow()
      } else {
        showMainWindow()
      }
    })
  })

  app.on('second-instance', () => {
    showMainWindow()
  })

  app.on('window-all-closed', () => {
    // Hidden-to-tray keeps a BrowserWindow alive; only quit when intentionally exiting.
    if (process.platform !== 'darwin' && isAppQuitting()) {
      app.quit()
    }
  })
}
