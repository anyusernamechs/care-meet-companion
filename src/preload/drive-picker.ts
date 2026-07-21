import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('drivePickerBridge', {
  listRoots: () => ipcRenderer.invoke('drive-picker:list-roots'),
  listFolders: (parentId: string, driveId?: string) =>
    ipcRenderer.invoke('drive-picker:list-folders', parentId, driveId),
  submit: (result: {
    folderId: string
    folderName: string
    pathLabel: string
    driveId?: string
  }) => ipcRenderer.send('drive-picker:submit', result),
  cancel: () => ipcRenderer.send('drive-picker:cancel')
})
