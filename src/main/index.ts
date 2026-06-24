import { app, BrowserWindow } from 'electron'
import { bootstrapEnv } from './env'
import { createMainWindow, registerIpcHandlers } from './ipc'
import { registerAppPermissions } from './permissions'
import { initAutoUpdates, registerAutoUpdateHandlers } from './auto-update'

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
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
      }
    })
  })

  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows[0]) {
      if (windows[0].isMinimized()) windows[0].restore()
      windows[0].focus()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
