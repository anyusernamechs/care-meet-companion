interface DriveLocation {
  id: string
  name: string
  driveId?: string
}

const statusEl = document.getElementById('status') as HTMLParagraphElement
const errorEl = document.getElementById('error') as HTMLParagraphElement
const spinnerEl = document.getElementById('spinner') as HTMLElement
const rootsEl = document.getElementById('roots') as HTMLDivElement
const breadcrumbEl = document.getElementById('breadcrumb') as HTMLDivElement
const foldersEl = document.getElementById('folders') as HTMLDivElement
const backButton = document.getElementById('back-button') as HTMLButtonElement
const chooseButton = document.getElementById('choose-button') as HTMLButtonElement
const cancelButton = document.getElementById('cancel-button') as HTMLButtonElement

let path: DriveLocation[] = []

function showError(message: string): void {
  spinnerEl.classList.add('hidden')
  statusEl.classList.add('hidden')
  errorEl.textContent = message
  errorEl.classList.remove('hidden')
}

function setLoading(message: string): void {
  spinnerEl.classList.remove('hidden')
  statusEl.textContent = message
  statusEl.classList.remove('hidden')
  errorEl.classList.add('hidden')
}

function currentLocation(): DriveLocation | undefined {
  return path[path.length - 1]
}

function renderBreadcrumb(): void {
  breadcrumbEl.replaceChildren()
  path.forEach((location, index) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = location.name
    button.addEventListener('click', () => {
      path = path.slice(0, index + 1)
      void loadCurrentFolder()
    })
    breadcrumbEl.appendChild(button)
    if (index < path.length - 1) breadcrumbEl.append('›')
  })
  backButton.disabled = path.length <= 1
}

async function loadCurrentFolder(): Promise<void> {
  const current = currentLocation()
  if (!current) return
  setLoading(`Loading ${current.name}…`)
  renderBreadcrumb()
  foldersEl.replaceChildren()

  try {
    const folders = await window.drivePickerBridge.listFolders(current.id, current.driveId)
    spinnerEl.classList.add('hidden')
    statusEl.textContent = folders.length
      ? 'Open a folder, or choose the current folder.'
      : 'This folder has no subfolders. You can choose it.'
    chooseButton.disabled = false

    for (const folder of folders) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'folder-row'
      const icon = document.createElement('span')
      icon.className = 'folder-icon'
      icon.setAttribute('aria-hidden', 'true')
      icon.textContent = '▰'
      const name = document.createElement('span')
      name.textContent = folder.name
      const arrow = document.createElement('span')
      arrow.setAttribute('aria-hidden', 'true')
      arrow.textContent = '›'
      button.append(icon, name, arrow)
      button.addEventListener('click', () => {
        path.push({ id: folder.id, name: folder.name, driveId: current.driveId })
        void loadCurrentFolder()
      })
      foldersEl.appendChild(button)
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error))
  }
}

async function bootstrap(): Promise<void> {
  try {
    setLoading('Loading Google Drive…')
    const roots = await window.drivePickerBridge.listRoots()
    spinnerEl.classList.add('hidden')
    statusEl.textContent = 'Choose My Drive or a Shared Drive.'
    for (const root of roots) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'root-button'
      button.textContent = root.name
      button.addEventListener('click', () => {
        path = [root]
        rootsEl.classList.add('hidden')
        void loadCurrentFolder()
      })
      rootsEl.appendChild(button)
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error))
  }
}

backButton.addEventListener('click', () => {
  if (path.length > 1) {
    path.pop()
    void loadCurrentFolder()
    return
  }
  path = []
  foldersEl.replaceChildren()
  breadcrumbEl.replaceChildren()
  rootsEl.classList.remove('hidden')
  chooseButton.disabled = true
  backButton.disabled = true
})

chooseButton.addEventListener('click', () => {
  const current = currentLocation()
  if (!current) return
  window.drivePickerBridge.submit({
    folderId: current.id,
    folderName: current.name,
    pathLabel: path.map((entry) => entry.name).join(' / '),
    driveId: current.driveId
  })
})

cancelButton.addEventListener('click', () => window.drivePickerBridge.cancel())

void bootstrap()
