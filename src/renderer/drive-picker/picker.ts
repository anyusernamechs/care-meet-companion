const statusEl = document.getElementById('status') as HTMLParagraphElement
const errorEl = document.getElementById('error') as HTMLParagraphElement
const spinnerEl = document.getElementById('spinner') as HTMLElement

function showError(message: string): void {
  spinnerEl.classList.add('hidden')
  statusEl.classList.add('hidden')
  errorEl.textContent = message
  errorEl.classList.remove('hidden')
}

function resolvePickerOrigin(): string {
  const origin = window.location.origin
  if (origin && origin !== 'null' && !origin.startsWith('file:')) {
    return origin
  }
  return 'http://localhost'
}

function loadPickerApi(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.gapi?.load) {
      window.gapi.load('picker', { callback: () => resolve() })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.async = true
    script.onload = () => {
      window.gapi.load('picker', { callback: () => resolve() })
    }
    script.onerror = () => reject(new Error('Could not load Google Picker.'))
    document.head.appendChild(script)
  })
}

function showPicker(credentials: { token: string; apiKey: string; appId: string }): void {
  const googlePicker = window.google?.picker
  if (!googlePicker) {
    showError('Google Picker failed to initialize.')
    return
  }

  const origin = resolvePickerOrigin()
  console.info('[drive-picker] origin', origin)

  const myDrive = new googlePicker.DocsView(googlePicker.ViewId.FOLDERS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setMimeTypes('application/vnd.google-apps.folder')
    .setLabel('My Drive')

  const sharedDrives = new googlePicker.DocsView(googlePicker.ViewId.FOLDERS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setEnableDrives(true)
    .setMimeTypes('application/vnd.google-apps.folder')
    .setLabel('Shared drives')

  const sharedWithMe = new googlePicker.DocsView(googlePicker.ViewId.FOLDERS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true)
    .setOwnedByMe(false)
    .setMimeTypes('application/vnd.google-apps.folder')
    .setLabel('Shared with me')

  const builder = new googlePicker.PickerBuilder()
    .setTitle('Select upload folder')
    .setOAuthToken(credentials.token)
    .setDeveloperKey(credentials.apiKey)
    .setAppId(credentials.appId)
    .setOrigin(origin)
    .addView(myDrive)
    .addView(sharedDrives)
    .addView(sharedWithMe)
    .enableFeature(googlePicker.Feature.SUPPORT_DRIVES)
    .setCallback((data: google.picker.ResponseObject) => {
      console.info('[drive-picker] callback', data.action)

      if (data.action === googlePicker.Action.PICKED && data.docs?.[0]) {
        const doc = data.docs[0]
        window.drivePickerBridge.submit({
          folderId: doc.id,
          folderName: doc.name || 'Selected folder',
          pathLabel: doc.name || 'Selected folder',
          driveId: doc.driveId || undefined
        })
        return
      }

      if (data.action === googlePicker.Action.CANCEL) {
        window.drivePickerBridge.cancel()
      }
    })

  spinnerEl.classList.add('hidden')
  statusEl.textContent = 'Choose a folder in the Google Drive window.'
  builder.build().setVisible(true)
}

async function bootstrap(): Promise<void> {
  try {
    if (!window.drivePickerBridge) {
      throw new Error('Picker bridge is not available. Restart the app.')
    }

    const credentials = await window.drivePickerBridge.getCredentials()
    await loadPickerApi()
    showPicker(credentials)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[drive-picker] bootstrap failed', error)
    showError(message)
    window.setTimeout(() => window.drivePickerBridge?.cancel(), 8000)
  }
}

void bootstrap()
