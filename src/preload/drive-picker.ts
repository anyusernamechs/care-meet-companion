import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('drivePickerBridge', {
  getCredentials: () =>
    ipcRenderer.invoke('drive-picker:get-credentials') as Promise<{
      token: string
      apiKey: string
      appId: string
    }>,
  submit: (result: {
    folderId: string
    folderName: string
    pathLabel: string
    driveId?: string
  }) => ipcRenderer.send('drive-picker:submit', result),
  cancel: () => ipcRenderer.send('drive-picker:cancel')
})
