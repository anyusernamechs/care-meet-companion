import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { getMainWindow } from './app-window'

export function assertTrustedRenderer(event: { sender: WebContents }): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Application window is not ready.')
  }

  if (event.sender.id !== mainWindow.webContents.id) {
    throw new Error('Unauthorized request.')
  }
}

export function trustedHandler<T extends unknown[], R>(
  handler: (event: IpcMainInvokeEvent, ...args: T) => R | Promise<R>
): (event: IpcMainInvokeEvent, ...args: T) => R | Promise<R> {
  return (event, ...args) => {
    assertTrustedRenderer(event)
    return handler(event, ...args)
  }
}
