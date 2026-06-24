export {}

declare global {
  interface Window {
    gapi: {
      load: (name: string, options: { callback: () => void }) => void
    }
    google: typeof google
    drivePickerBridge: {
      getCredentials: () => Promise<{ token: string; apiKey: string; appId: string }>
      submit: (result: {
        folderId: string
        folderName: string
        pathLabel: string
        driveId?: string
      }) => void
      cancel: () => void
    }
  }

  namespace google.picker {
    interface DocumentObject {
      id: string
      name: string
      driveId?: string
    }

    interface ResponseObject {
      action: string
      docs?: DocumentObject[]
    }

    class DocsView {
      constructor(viewId: string)
      setIncludeFolders(enabled: boolean): DocsView
      setSelectFolderEnabled(enabled: boolean): DocsView
      setMimeTypes(mimeTypes: string): DocsView
      setLabel(label: string): DocsView
      setEnableDrives(enabled: boolean): DocsView
      setOwnedByMe(owned: boolean): DocsView
    }

    class PickerBuilder {
      setTitle(title: string): PickerBuilder
      setOAuthToken(token: string): PickerBuilder
      setDeveloperKey(key: string): PickerBuilder
      setAppId(appId: string): PickerBuilder
      setOrigin(origin: string): PickerBuilder
      addView(view: DocsView): PickerBuilder
      enableFeature(feature: string): PickerBuilder
      setCallback(callback: (data: ResponseObject) => void): PickerBuilder
      build(): { setVisible: (visible: boolean) => void }
    }

    const ViewId: { FOLDERS: string }
    const Action: { PICKED: string; CANCEL: string }
    const Feature: { SUPPORT_DRIVES: string }
  }

  const google: {
    picker: typeof google.picker
  }
}
