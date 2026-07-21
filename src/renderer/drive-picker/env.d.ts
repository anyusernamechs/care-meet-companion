export {}

interface DriveRoot {
  id: string
  name: string
  driveId?: string
}

interface DriveFolder {
  id: string
  name: string
}

declare global {
  interface Window {
    drivePickerBridge: {
      listRoots: () => Promise<DriveRoot[]>
      listFolders: (parentId: string, driveId?: string) => Promise<DriveFolder[]>
      submit: (result: {
        folderId: string
        folderName: string
        pathLabel: string
        driveId?: string
      }) => void
      cancel: () => void
    }
  }
}
