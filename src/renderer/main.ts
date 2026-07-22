import type {
  AppUpdateEvent,
  CalendarMeeting,
  CaptureMode,
  CaptureSource,
  DriveDestination,
  SessionMode
} from '../shared/types'

type UIState = 'idle' | 'checking' | 'recording' | 'processing' | 'complete' | 'error'

const meetingTitleInput = document.getElementById('meeting-title') as HTMLInputElement
const captureModeSelect = document.getElementById('capture-mode-select') as HTMLSelectElement
const sourcePicker = document.getElementById('source-picker') as HTMLElement
const sourceSelect = document.getElementById('source-select') as HTMLSelectElement
const sourcePreview = document.getElementById('source-preview') as HTMLElement
const sourceThumbnail = document.getElementById('source-thumbnail') as HTMLImageElement
const sourceName = document.getElementById('source-name') as HTMLParagraphElement
const startButton = document.getElementById('start-button') as HTMLButtonElement
const stopButton = document.getElementById('stop-button') as HTMLButtonElement
const storageHealth = document.getElementById('storage-health') as HTMLParagraphElement
const sessionReady = document.getElementById('session-ready') as HTMLElement
const sessionActive = document.getElementById('session-active') as HTMLElement
const sessionProcessing = document.getElementById('session-processing') as HTMLElement
const readyStatusPill = document.getElementById('ready-status-pill') as HTMLElement
const readyStatusText = document.getElementById('ready-status-text') as HTMLParagraphElement
const recordingTimer = document.getElementById('recording-timer') as HTMLParagraphElement
const recordingLabel = document.getElementById('recording-label') as HTMLParagraphElement
const statusVideo = document.getElementById('status-video') as HTMLLIElement
const statusAudio = document.getElementById('status-audio') as HTMLLIElement
const statusMicrophone = document.getElementById('status-microphone') as HTMLLIElement
const statusDrive = document.getElementById('status-drive') as HTMLLIElement
const statusStorage = document.getElementById('status-storage') as HTMLLIElement
const audioMeters = document.getElementById('audio-meters') as HTMLElement
const participantAudioMeter = document.getElementById('participant-audio-meter') as HTMLElement
const microphoneAudioMeter = document.getElementById('microphone-audio-meter') as HTMLElement
const statusTranscript = document.getElementById('status-transcript') as HTMLLIElement
const captureStatusList = document.getElementById('capture-status-list') as HTMLUListElement
const statusDetail = document.getElementById('status-detail') as HTMLParagraphElement
const errorOpenFolderButton = document.getElementById('error-open-folder-button') as HTMLButtonElement
const hideToTrayButton = document.getElementById('hide-to-tray-button') as HTMLButtonElement
const readinessMeeting = document.getElementById('readiness-meeting') as HTMLLIElement
const readinessEquipment = document.getElementById('readiness-equipment') as HTMLLIElement
const readinessDestination = document.getElementById('readiness-destination') as HTMLLIElement
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement
const completeCard = document.getElementById('complete-card') as HTMLElement
const completeMessage = document.getElementById('complete-message') as HTMLParagraphElement
const newRecordingButton = document.getElementById('new-recording-button') as HTMLButtonElement
const authStatus = document.getElementById('auth-status') as HTMLParagraphElement
const authButton = document.getElementById('auth-button') as HTMLButtonElement
const signOutButton = document.getElementById('sign-out-button') as HTMLButtonElement
const openFolderButton = document.getElementById('open-folder-button') as HTMLButtonElement
const recordingsPath = document.getElementById('recordings-path') as HTMLParagraphElement
const recordingsPathHint = document.getElementById('recordings-path-hint') as HTMLParagraphElement
const changeRecordingsDirButton = document.getElementById(
  'change-recordings-dir-button'
) as HTMLButtonElement
const calendarStatus = document.getElementById('calendar-status') as HTMLParagraphElement
const calendarMeetingSelect = document.getElementById('calendar-meeting-select') as HTMLSelectElement
const calendarMeetingList = document.getElementById('calendar-meeting-list') as HTMLElement
const refreshCalendarButton = document.getElementById('refresh-calendar-button') as HTMLButtonElement
const heroMeetingBadge = document.getElementById('hero-meeting-badge') as HTMLParagraphElement
const heroMeetingTitle = document.getElementById('hero-meeting-title') as HTMLHeadingElement
const heroMeetingTime = document.getElementById('hero-meeting-time') as HTMLParagraphElement
const heroMeetingLink = document.getElementById('hero-meeting-link') as HTMLParagraphElement
const openMeetButton = document.getElementById('open-meet-button') as HTMLButtonElement
const openMeetBrowserButton = document.getElementById('open-meet-browser-button') as HTMLButtonElement
const copyMeetLinkButton = document.getElementById('copy-meet-link-button') as HTMLButtonElement
const meetStatus = document.getElementById('meet-status') as HTMLParagraphElement
const driveFolderLabel = document.getElementById('drive-folder-label') as HTMLParagraphElement
const driveDestinationHint = document.getElementById('drive-destination-hint') as HTMLParagraphElement
const chooseDriveFolderButton = document.getElementById('choose-drive-folder-button') as HTMLButtonElement
const clearDriveFolderButton = document.getElementById('clear-drive-folder-button') as HTMLButtonElement
const meetingDriveFolderLabel = document.getElementById('meeting-drive-folder-label') as HTMLParagraphElement
const meetingDriveDestinationHint = document.getElementById('meeting-drive-destination-hint') as HTMLParagraphElement
const meetingChooseDriveFolderButton = document.getElementById('meeting-choose-drive-folder-button') as HTMLButtonElement
const meetingClearDriveFolderButton = document.getElementById('meeting-clear-drive-folder-button') as HTMLButtonElement
const recordSourceOptions = document.getElementById('record-source-options') as HTMLElement
const notesOnlyHint = document.getElementById('notes-only-hint') as HTMLElement
const captionReminder = document.getElementById('caption-reminder') as HTMLElement
const captionHealth = document.getElementById('caption-health') as HTMLParagraphElement
const recordingNoticeCheckbox = document.getElementById('recording-notice-checkbox') as HTMLInputElement
const afterPromiseList = document.getElementById('after-promise-list') as HTMLUListElement
const appStatusBarText = document.getElementById('app-status-bar-text') as HTMLParagraphElement
const statusChipAccount = document.getElementById('status-chip-account') as HTMLElement
const statusChipDrive = document.getElementById('status-chip-drive') as HTMLElement
const appUpdateBar = document.getElementById('app-update-bar') as HTMLElement
const appUpdateText = document.getElementById('app-update-text') as HTMLParagraphElement
const appUpdateAction = document.getElementById('app-update-action') as HTMLButtonElement
const updateStatus = document.getElementById('update-status') as HTMLParagraphElement
const checkUpdatesButton = document.getElementById('check-updates-button') as HTMLButtonElement
const settingsFoldSummary = document.getElementById('settings-fold-summary') as HTMLSpanElement
const meetingDetails = document.getElementById('meeting-details') as HTMLElement
const settingsDetails = document.getElementById('settings-details') as HTMLDetailsElement
const focusModeButton = document.getElementById('focus-mode-button') as HTMLButtonElement
const returnSetupButton = document.getElementById('return-setup-button') as HTMLButtonElement
const primaryTabButton = document.getElementById('primary-tab-button') as HTMLButtonElement
const settingsTabButton = document.getElementById('settings-tab-button') as HTMLButtonElement
const expandPanelButton = document.getElementById('expand-panel-button') as HTMLButtonElement
const sessionModeInputs = document.querySelectorAll(
  'input[name="session-mode"]'
) as NodeListOf<HTMLInputElement>

let transcriptionReady = false
let driveFolderSelected = false
let currentDriveDestination: DriveDestination | null = null
let recordingsDirLocked = false
let appVersion = ''

let sources: CaptureSource[] = []
let calendarMeetings: CalendarMeeting[] = []
let selectedCalendarMeeting: CalendarMeeting | null = null
let captureMode: CaptureMode = 'meet-tab'
let sessionMode: SessionMode = 'record'
let hostEmail = ''
let authStateInitialized = false
let hostDisplayName = ''
let mediaRecorder: MediaRecorder | null = null
let recordingStream: MediaStream | null = null
let micStream: MediaStream | null = null
let recordingAudioContext: AudioContext | null = null
let recordingTimerId: number | null = null
let recordingClockStart = 0
let sessionId = ''
let startedAt = ''
let uiState: UIState = 'idle'
let progressUnsubscribe: (() => void) | null = null
let meetEndedUnsubscribe: (() => void) | null = null
let sidebarUnsubscribe: (() => void) | null = null
let chunkWriteChain = Promise.resolve()
let sessionEnding = false
let recordingBytesReceived = 0
let captionHealthTimerId: number | null = null
let captureFailureReported = false
let audioMeterAnimationId: number | null = null
let participantAnalyser: AnalyserNode | null = null
let microphoneAnalyser: AnalyserNode | null = null
let participantPeak = 0
let microphonePeak = 0
let meetReady = false
let meetAwarenessTimerId: number | null = null
let storageMonitorTimerId: number | null = null
let lastDetectedMeetingCode = ''
let meetAccountEmail = ''
let lastHealthUiUpdate = 0

const RECORDER_SLICE_MS = 2000

function showPanelView(view: 'primary' | 'settings'): void {
  const settings = view === 'settings'
  document.body.classList.toggle('settings-view', settings)
  primaryTabButton.classList.toggle('active', !settings)
  settingsTabButton.classList.toggle('active', settings)
  primaryTabButton.setAttribute('aria-selected', String(!settings))
  settingsTabButton.setAttribute('aria-selected', String(settings))
  if (settings) settingsDetails.open = true
}

function updateNavigationLabels(): void {
  primaryTabButton.textContent = document.body.classList.contains('meet-mode') ? 'Recording' : 'Meetings'
}

function meetingCodeFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
    return path.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:\/|$)/i)?.[1]?.toLowerCase() || ''
  } catch {
    return ''
  }
}

function formatStorage(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(bytes < 10 * 1024 ** 3 ? 1 : 0)} GB`
}

async function refreshStorageHealth(): Promise<number> {
  const status = await window.careRecorder.getStorageStatus()
  storageHealth.textContent = `${formatStorage(status.availableBytes)} available for recordings`
  storageHealth.classList.toggle('warn', status.availableBytes < 5 * 1024 ** 3)
  setCaptureStatusLine(
    statusStorage,
    'Storage',
    status.availableBytes < 5 * 1024 ** 3 ? 'idle' : 'live',
    `${formatStorage(status.availableBytes)} free`
  )
  return status.availableBytes
}

async function verifyStorageBeforeRecording(): Promise<void> {
  const available = await refreshStorageHealth()
  if (available < 2 * 1024 ** 3) {
    throw new Error(
      `Not enough free storage to record safely (${formatStorage(available)} available). Free at least 5 GB and try again.`
    )
  }
  if (available < 5 * 1024 ** 3) {
    const proceed = window.confirm(
      `Only ${formatStorage(available)} of free storage is available. A long meeting may not finish safely. Continue anyway?`
    )
    if (!proceed) throw new Error('Recording cancelled so storage can be freed safely.')
  }
}

function startStorageMonitor(): void {
  stopStorageMonitor()
  storageMonitorTimerId = window.setInterval(() => {
    void refreshStorageHealth().then((available) => {
      if (available < 1024 ** 3) {
        void handleCaptureFailure('Available storage fell below 1 GB.')
      }
    }).catch(() => handleCaptureFailure('The recordings folder is no longer available.'))
  }, 60_000)
}

function stopStorageMonitor(): void {
  if (storageMonitorTimerId !== null) {
    window.clearInterval(storageMonitorTimerId)
    storageMonitorTimerId = null
  }
}

function queueRecordingChunk(chunk: ArrayBuffer, isFinal: boolean): Promise<void> {
  if (!isFinal && chunk.byteLength > 0) {
    recordingBytesReceived += chunk.byteLength
  }
  chunkWriteChain = chunkWriteChain.then(() =>
    window.careRecorder.saveRecordingChunk(sessionId, chunk, isFinal)
  )
  return chunkWriteChain
}

function attachCaptureTrackGuards(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.addEventListener('ended', () => {
      if (uiState === 'recording' && !sessionEnding) {
        void handleCaptureFailure(
          `${track.kind === 'audio' ? 'An audio source' : 'The video source'} stopped unexpectedly.`
        )
      }
    })
  }
}

async function handleCaptureFailure(message: string): Promise<void> {
  if (captureFailureReported || sessionEnding || uiState !== 'recording') return
  captureFailureReported = true
  console.error(`Recording capture failure: ${message}`)
  window.alert(`${message}\n\nThe recording will stop now so the partial recording can be saved.`)
  await endSession('Capture stopped unexpectedly — saving the partial recording...')
}

function bindMeetAccount(url: string): string {
  if (!hostEmail) return url
  const target = new URL(url)
  target.searchParams.set('authuser', hostEmail)
  return target.toString()
}

function getMeetUrl(): string {
  const url = (
    selectedCalendarMeeting?.hangoutLink ||
    (selectedCalendarMeeting?.meetingCode
      ? `https://meet.google.com/${selectedCalendarMeeting.meetingCode}`
      : 'https://meet.google.com')
  )
  return bindMeetAccount(url)
}

function getMeetLinkDisplay(): string {
  const url = getMeetUrl()
  return url.replace(/^https?:\/\//, '')
}

function formatHeroMeetingTime(meeting: CalendarMeeting): string {
  const start = new Date(meeting.startTime)
  const end = new Date(meeting.endTime)
  const today = new Date()
  const isToday = start.toDateString() === today.toDateString()
  const dayLabel = isToday
    ? 'Today'
    : start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${dayLabel}, ${startTime} – ${endTime}`
}

function setCaptureStatusLine(
  element: HTMLLIElement,
  label: string,
  state: 'live' | 'off' | 'idle',
  detail?: string
): void {
  element.className = state
  const stateLabel = state === 'live' ? 'capturing' : state === 'idle' ? 'live' : 'off'
  element.innerHTML = `<span class="dot"></span><span class="health-label">${label}</span><strong>${detail || stateLabel}</strong>`
}

function updateCaptureStatuses(state: 'idle' | 'recording' | 'notes'): void {
  audioMeters.classList.toggle('hidden', state !== 'recording')
  if (state === 'idle') {
    setCaptureStatusLine(statusVideo, 'Video', 'off')
    setCaptureStatusLine(statusAudio, 'Participant audio', 'off')
    setCaptureStatusLine(statusMicrophone, 'Microphone', 'off')
    setCaptureStatusLine(statusDrive, 'Google Drive', currentDriveDestination ? 'live' : 'idle', currentDriveDestination ? 'Ready' : 'Local only')
    setCaptureStatusLine(statusTranscript, 'Transcript', 'off')
    return
  }

  if (state === 'notes') {
    setCaptureStatusLine(statusVideo, 'Video', 'off')
    setCaptureStatusLine(statusAudio, 'Participant audio', 'off')
    setCaptureStatusLine(statusMicrophone, 'Microphone', 'off')
    setCaptureStatusLine(statusDrive, 'Google Drive', currentDriveDestination ? 'live' : 'idle', currentDriveDestination ? 'Ready' : 'Local only')
    setCaptureStatusLine(statusTranscript, 'Transcript', 'live')
    return
  }

  setCaptureStatusLine(statusVideo, 'Video', 'live')
  setCaptureStatusLine(statusAudio, 'Participant audio', 'live', 'Monitoring')
  setCaptureStatusLine(statusMicrophone, 'Microphone', 'live')
  setCaptureStatusLine(statusDrive, 'Google Drive', currentDriveDestination ? 'live' : 'idle', currentDriveDestination ? 'Ready' : 'Local only')
  setCaptureStatusLine(statusTranscript, 'Transcript', 'live', 'After saving')
}

function setReadinessItem(element: HTMLLIElement, ready: boolean): void {
  element.classList.toggle('ready', ready)
  const icon = element.querySelector('.readiness-icon')
  if (icon) icon.textContent = ready ? '✓' : icon.textContent === '✓' ? '•' : icon.textContent
}

function updateReadiness(): void {
  const needsMeet = getSessionMode() === 'notes-only' || captureMode === 'meet-tab'
  const meetingOk = !needsMeet || meetReady
  setReadinessItem(readinessMeeting, meetingOk)
  setReadinessItem(readinessEquipment, uiState === 'recording')
  setReadinessItem(readinessDestination, Boolean(recordingsPath.textContent?.trim()))

  if (uiState !== 'idle') return
  const noticeConfirmed = recordingNoticeCheckbox.checked
  startButton.disabled = !meetingOk || !noticeConfirmed
  if (!meetingOk) {
    readyStatusPill.textContent = 'Next step'
    updateReadyStatus('Open your meeting above to continue')
  } else if (!noticeConfirmed) {
    readyStatusPill.textContent = 'Confirmation needed'
    updateReadyStatus('Confirm that everyone has been notified')
  } else {
    readyStatusPill.textContent = 'Ready'
    updateReadyStatus(getSessionMode() === 'notes-only' ? 'Ready to start notes' : 'Ready to check and record')
  }
}

function analyserLevel(analyser: AnalyserNode): number {
  const samples = new Uint8Array(analyser.fftSize)
  analyser.getByteTimeDomainData(samples)
  let sumSquares = 0
  for (const sample of samples) {
    const centered = (sample - 128) / 128
    sumSquares += centered * centered
  }
  return Math.sqrt(sumSquares / samples.length)
}

function renderAudioMeter(element: HTMLElement, level: number): void {
  const percent = Math.min(100, Math.max(0, Math.round(level * 360)))
  element.style.width = `${percent}%`
  element.parentElement?.setAttribute('aria-valuenow', String(percent))
}

function startAudioMeters(): void {
  if (audioMeterAnimationId !== null) {
    window.cancelAnimationFrame(audioMeterAnimationId)
    audioMeterAnimationId = null
  }
  const tick = (): void => {
    if (!participantAnalyser || !microphoneAnalyser) return
    const participantLevel = analyserLevel(participantAnalyser)
    const microphoneLevel = analyserLevel(microphoneAnalyser)
    participantPeak = Math.max(participantPeak, participantLevel)
    microphonePeak = Math.max(microphonePeak, microphoneLevel)
    renderAudioMeter(participantAudioMeter, participantLevel)
    renderAudioMeter(microphoneAudioMeter, microphoneLevel)
    const now = Date.now()
    if (now - lastHealthUiUpdate >= 500) {
      const participantPercent = Math.min(100, Math.round(participantLevel * 360))
      const microphonePercent = Math.min(100, Math.round(microphoneLevel * 360))
      setCaptureStatusLine(
        statusAudio,
        'Participant audio',
        participantPercent > 0 ? 'live' : 'idle',
        participantPercent > 0 ? `${participantPercent}%` : 'Quiet'
      )
      setCaptureStatusLine(
        statusMicrophone,
        'Microphone',
        microphonePercent > 0 ? 'live' : 'idle',
        microphonePercent > 0 ? `${microphonePercent}%` : 'Quiet'
      )
      lastHealthUiUpdate = now
    }
    audioMeterAnimationId = window.requestAnimationFrame(tick)
  }
  audioMeterAnimationId = window.requestAnimationFrame(tick)
}

function stopAudioMeters(): void {
  if (audioMeterAnimationId !== null) {
    window.cancelAnimationFrame(audioMeterAnimationId)
    audioMeterAnimationId = null
  }
  participantAnalyser = null
  microphoneAnalyser = null
  renderAudioMeter(participantAudioMeter, 0)
  renderAudioMeter(microphoneAudioMeter, 0)
}

async function verifyAudioSignals(): Promise<void> {
  participantPeak = 0
  microphonePeak = 0
  startAudioMeters()
  await new Promise((resolve) => window.setTimeout(resolve, 1800))

  const missing: string[] = []
  if (participantPeak < 0.001) missing.push('participant audio')
  if (microphonePeak < 0.002) missing.push('your microphone')
  if (missing.length === 0) return

  const proceed = window.confirm(
    `The audio check detected no activity from ${missing.join(' and ')}.\n\nMake sure the source is unmuted and someone speaks during the check. Continue anyway?`
  )
  if (!proceed) {
    throw new Error('Recording cancelled because the audio signal check did not pass.')
  }
}

async function runRecordingCountdown(): Promise<void> {
  recordingLabel.textContent = 'Recording starts in'
  recordingTimer.classList.remove('hidden')
  for (const count of [3, 2, 1]) {
    recordingTimer.textContent = String(count)
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
  }
  recordingLabel.textContent = 'Starting recording'
  recordingTimer.textContent = 'Now'
}

function updateReadyStatus(text: string): void {
  readyStatusText.textContent = text
}

function updateAfterPromise(): void {
  const notesOnly = getSessionMode() === 'notes-only'
  const items = notesOnly
    ? ['Save transcript with names', 'Upload to Google Drive']
    : ['Save MP4', 'Transcribe + name speakers', 'Upload to Google Drive']

  if (!driveFolderSelected) {
    const uploadIndex = items.findIndex((item) => item.startsWith('Upload'))
    if (uploadIndex >= 0) {
      items[uploadIndex] = 'Keep local copy (no Google Drive folder selected)'
    }
  }

  afterPromiseList.innerHTML = items.map((item) => `<li>${item}</li>`).join('')
}

function updateFoldSummaries(): void {
  const settingsParts: string[] = []
  if (hostEmail) {
    const shortEmail = hostEmail.split('@')[0] || hostEmail
    settingsParts.push(shortEmail)
  } else {
    settingsParts.push('Sign in')
  }
  if (driveFolderSelected) {
    settingsParts.push('Drive ready')
  }
  settingsFoldSummary.textContent = settingsParts.join(' · ')
}

async function updateAppStatusBar(): Promise<void> {
  const warnings: string[] = []

  if (!hostEmail) warnings.push('Google account not connected')

  if (!transcriptionReady) {
    warnings.push('Transcript tools unavailable')
  }

  statusChipAccount.textContent = hostEmail ? hostEmail.split('@')[0] || 'Signed in' : 'Sign in'
  statusChipAccount.classList.toggle('ready', Boolean(hostEmail))
  statusChipDrive.textContent = driveFolderSelected ? 'Drive ready' : 'Local save'
  statusChipDrive.classList.toggle('ready', driveFolderSelected)

  if (warnings.length) {
    appStatusBarText.textContent = warnings.join(' · ')
    appStatusBarText.classList.add('warn')
  } else {
    const storage = driveFolderSelected ? 'Google Drive ready' : 'Saving locally'
    appStatusBarText.textContent = appVersion ? `${storage} · v${appVersion}` : storage
    appStatusBarText.classList.remove('warn')
  }
}

function showAppUpdate(event: AppUpdateEvent): void {
  const version = event.version?.trim()

  if (updateStatus) {
    if (event.status === 'checking') {
      updateStatus.textContent = 'Checking for updates…'
    } else if (event.status === 'available') {
      updateStatus.textContent = `Version ${version} is available and downloading…`
    } else if (event.status === 'downloading') {
      updateStatus.textContent = `Downloading version ${version}…`
    } else if (event.status === 'downloaded') {
      updateStatus.textContent = `Version ${version} is ready — restart to install.`
    } else if (event.status === 'error') {
      updateStatus.textContent = event.message || 'Could not check for updates.'
    } else {
      updateStatus.textContent = `You're on the latest version${version ? ` (v${version})` : ''}.`
    }
  }

  if (event.status === 'checking' || event.status === 'not-available') {
    if (event.status === 'not-available') {
      // Keep a ready-to-install banner if a download already finished.
      if (!appUpdateAction.classList.contains('hidden') && !appUpdateBar.classList.contains('hidden')) {
        return
      }
      appUpdateBar.classList.add('hidden')
      appUpdateAction.classList.add('hidden')
    }
    return
  }

  if (event.status === 'error') {
    appUpdateBar.classList.remove('hidden')
    appUpdateBar.classList.add('is-error')
    appUpdateText.textContent = event.message || 'Could not check for updates.'
    appUpdateAction.classList.add('hidden')
    return
  }

  appUpdateBar.classList.remove('hidden', 'is-error')

  if (event.status === 'available' || event.status === 'downloading') {
    appUpdateText.textContent =
      event.status === 'downloading'
        ? `Downloading update v${version}…`
        : `New version available: v${version}`
    appUpdateAction.classList.add('hidden')
    return
  }

  if (event.status === 'downloaded') {
    appUpdateText.textContent = `Update v${version} is ready to install`
    appUpdateAction.classList.remove('hidden')
  }
}

function subscribeAppUpdates(): void {
  window.careRecorder.onAppUpdate((event) => {
    showAppUpdate(event)
  })
}

function setUiState(state: UIState): void {
  uiState = state
  document.body.classList.toggle(
    'session-in-progress',
    state === 'checking' || state === 'recording' || state === 'processing'
  )

  const idle = state === 'idle'
  const checking = state === 'checking'
  const recording = state === 'recording'
  const processing = state === 'processing' || state === 'error'
  const complete = state === 'complete'

  startButton.classList.toggle('hidden', !idle)
  stopButton.classList.toggle('hidden', !recording)
  stopButton.disabled = !recording

  sessionReady.classList.toggle('hidden', !idle)
  sessionActive.classList.toggle('hidden', !recording && !checking)
  sessionProcessing.classList.toggle('hidden', !processing)

  completeCard.classList.toggle('hidden', !complete)

  if (idle) {
    updateCaptureStatuses('idle')
  }

  if (recording) {
    recordingLabel.textContent = 'Recording in progress'
    recordingTimer.classList.remove('hidden')
    updateCaptureStatuses(getSessionMode() === 'notes-only' ? 'notes' : 'recording')
  }

  if (checking) {
    recordingLabel.textContent = 'Checking your equipment'
    recordingTimer.classList.add('hidden')
    audioMeters.classList.remove('hidden')
    captureStatusList.classList.add('hidden')
  } else {
    captureStatusList.classList.remove('hidden')
  }

  meetingTitleInput.disabled = !idle
  captureModeSelect.disabled = !idle || sessionMode === 'notes-only'
  sourceSelect.disabled = !idle
  calendarMeetingSelect.disabled = !idle || !hostEmail
  refreshCalendarButton.disabled = !idle || !hostEmail
  openMeetButton.disabled = !idle || !hostEmail
  openMeetBrowserButton.disabled = !idle || !selectedCalendarMeeting
  copyMeetLinkButton.disabled = !idle || !selectedCalendarMeeting
  authButton.disabled = state === 'recording' || state === 'processing'
  returnSetupButton.disabled = state !== 'idle' && state !== 'complete' && state !== 'error'
  settingsTabButton.disabled = state !== 'idle' && state !== 'complete' && state !== 'error'
  signOutButton.disabled = !hostEmail || state !== 'idle'
  chooseDriveFolderButton.disabled = !hostEmail || state !== 'idle'
  meetingChooseDriveFolderButton.disabled = !hostEmail || state !== 'idle'
  changeRecordingsDirButton.disabled = recordingsDirLocked || state !== 'idle'
  recordingNoticeCheckbox.disabled = !idle
  for (const input of sessionModeInputs) {
    input.disabled = !idle
  }
  updateSessionModeUi()
  errorOpenFolderButton.classList.toggle('hidden', state !== 'error')
  hideToTrayButton.classList.toggle('hidden', state !== 'processing')
  statusDetail.textContent =
    state === 'error'
      ? 'Your original recording was preserved. Open the folder or contact support before trying again.'
      : 'Large uploads can continue in the tray — you’ll get a notification when finished.'
  sessionProcessing.classList.toggle('is-error', state === 'error')
  updateReadiness()
  void updateAppStatusBar()
}

const FRIENDLY_PROGRESS = new Set([
  'Recording...',
  'Taking notes...',
  'Stopping recording...',
  'Saving your notes...',
  'Saving your video...',
  'Checking for a Google Meet transcript...',
  'Saving Google Meet transcript with speaker names...',
  'Writing the transcript...',
  'Writing the transcript… this may take several minutes for long meetings.',
  'Adding speaker names from Meet video tiles...',
  'Saving transcript with participant names...',
  'Creating Google Drive folder...',
  'Uploading to Google Drive...',
  'Uploading notes...',
  'Uploading transcript...',
  'All done!'
])

function setStatus(message: string): void {
  statusMessage.textContent = message
}

function appendProgress(message: string): void {
  if (
    FRIENDLY_PROGRESS.has(message) ||
    message.startsWith('Recording') ||
    message.startsWith('Writing the transcript') ||
    message.startsWith('Saving transcript') ||
    message.startsWith('Uploading') ||
    message.startsWith('Creating Google Drive')
  ) {
    setStatus(message)
  }
}

function defaultMeetingTitle(): string {
  const now = new Date()
  return `Meeting - ${now.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`
}

function formatMeetingTime(meeting: CalendarMeeting): string {
  const start = new Date(meeting.startTime)
  const end = new Date(meeting.endTime)
  return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function applySidebarUi(expanded: boolean): void {
  document.body.classList.toggle('focus-mode', !expanded)
  const chevron = focusModeButton.querySelector('.collapse-chevron')
  if (chevron) {
    chevron.textContent = expanded ? '‹' : '›'
  }
  focusModeButton.title = expanded
    ? 'Hide panel for full meeting view (Alt+Shift+M)'
    : 'Show panel (Alt+Shift+M)'
  focusModeButton.setAttribute('aria-label', expanded ? 'Hide panel' : 'Show panel')
}

async function setSidebarExpanded(expanded: boolean): Promise<void> {
  await window.careRecorder.setSidebarExpanded(expanded)
  applySidebarUi(expanded)
}

function subscribeSidebarChanges(): void {
  sidebarUnsubscribe?.()
  sidebarUnsubscribe = window.careRecorder.onSidebarChanged((expanded) => {
    applySidebarUi(expanded)
  })
}

function getSessionMode(): SessionMode {
  const selected = Array.from(sessionModeInputs).find((input) => input.checked)
  return selected?.value === 'notes-only' ? 'notes-only' : 'record'
}

function updateCaptionReminder(): void {
  // Record mode uses Whisper; only notes-only still depends on Meet CC.
  captionReminder.classList.toggle('hidden', getSessionMode() === 'notes-only')
}

function updateSessionModeUi(): void {
  sessionMode = getSessionMode()
  const notesOnly = sessionMode === 'notes-only'

  recordSourceOptions.classList.toggle('hidden', notesOnly)
  notesOnlyHint.classList.toggle('hidden', !notesOnly)
  updateCaptionReminder()
  startButton.textContent = notesOnly ? 'Start notes' : 'Start recording'
  stopButton.textContent = notesOnly ? 'Stop and save notes' : 'Stop and save'

  if (notesOnly && captureMode !== 'meet-tab') {
    captureModeSelect.value = 'meet-tab'
    updateCaptureModeUi()
  }

  captureModeSelect.disabled = notesOnly || uiState !== 'idle'
  updateAfterPromise()

  if (uiState === 'idle') {
    updateReadiness()
  }
}

function updateCaptureModeUi(): void {
  captureMode = captureModeSelect.value as CaptureMode
  sourcePicker.classList.toggle('hidden', captureMode === 'meet-tab')
  updateCaptionReminder()
  void window.careRecorder.setCaptureMode(captureMode)
  updateReadiness()
}

function updateSourcePreview(source?: CaptureSource): void {
  if (!source) {
    sourcePreview.classList.add('hidden')
    return
  }

  sourcePreview.classList.remove('hidden')
  sourceThumbnail.src = source.thumbnail
  sourceName.textContent = source.name
  void window.careRecorder.setCaptureSource(source.id)
}

function applyCalendarMeeting(meeting: CalendarMeeting | null): void {
  selectedCalendarMeeting = meeting
  const canUseSelection = Boolean(meeting) && uiState === 'idle'
  openMeetButton.disabled = uiState !== 'idle' || !hostEmail
  openMeetButton.textContent = !hostEmail
    ? 'Sign in to continue'
    : meeting
      ? 'Open meeting'
      : 'Open Google Meet'
  openMeetBrowserButton.disabled = !canUseSelection
  copyMeetLinkButton.disabled = !canUseSelection

  if (!meeting) {
    heroMeetingBadge.classList.add('hidden')
    heroMeetingTitle.textContent = hostEmail ? 'Choose a meeting below' : 'Connect Google to see your meetings'
    heroMeetingTime.textContent = hostEmail ? 'Nothing is selected yet' : 'Your calendar meetings will appear here'
    heroMeetingLink.textContent = ''
    updateFoldSummaries()
    return
  }

  meetingTitleInput.value = meeting.title
  heroMeetingBadge.classList.toggle('hidden', !meeting.isActive)
  heroMeetingTitle.textContent = meeting.title
  heroMeetingTime.textContent = formatHeroMeetingTime(meeting)
  heroMeetingLink.textContent = meeting.hangoutLink
    ? meeting.hangoutLink.replace(/^https?:\/\//, '')
    : meeting.meetingCode
      ? `meet.google.com/${meeting.meetingCode}`
      : 'meet.google.com'
  updateFoldSummaries()
}

function renderCalendarMeetings(): void {
  calendarMeetingSelect.innerHTML = ''
  calendarMeetingList.replaceChildren()

  if (!hostEmail) {
    calendarMeetingSelect.innerHTML = '<option value="">Connect Google to see your meetings</option>'
    calendarStatus.textContent = 'Sign in to load your personal calendar'
    calendarMeetingList.innerHTML = '<p class="meeting-empty">Connect your Google account to see upcoming meetings.</p>'
    applyCalendarMeeting(null)
    return
  }

  if (calendarMeetings.length === 0) {
    calendarMeetingSelect.innerHTML = '<option value="">No Meet events in the next 24 hours</option>'
    calendarStatus.textContent = 'No Google Meet events in the next 24 hours'
    calendarMeetingList.innerHTML = '<p class="meeting-empty">No upcoming meetings. You can create one directly in Meet.</p>'
    applyCalendarMeeting(null)
    return
  }

  calendarStatus.textContent = `${calendarMeetings.length} meeting(s) — switch below if needed`

  for (const meeting of calendarMeetings) {
    const option = document.createElement('option')
    option.value = meeting.id
    const prefix = meeting.isActive ? 'Now' : 'Next'
    option.textContent = `${prefix}: ${meeting.title} (${formatMeetingTime(meeting)})`
    calendarMeetingSelect.appendChild(option)

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'meeting-event'
    button.dataset.meetingId = meeting.id
    button.setAttribute('aria-pressed', 'false')
    const title = document.createElement('span')
    title.className = 'meeting-event-title'
    title.textContent = meeting.title
    const meta = document.createElement('span')
    meta.className = 'meeting-event-meta'
    meta.textContent = `${meeting.isActive ? 'Happening now' : 'Upcoming'} · ${formatMeetingTime(meeting)}`
    button.append(title, meta)
    calendarMeetingList.appendChild(button)
  }

  calendarMeetingSelect.value = ''
  applyCalendarMeeting(null)
}

async function refreshMeetStatus(): Promise<void> {
  const status = await window.careRecorder.getMeetStatus()
  document.body.classList.toggle('meet-mode', status.open)
  updateNavigationLabels()
  const detectedCode = status.url ? meetingCodeFromUrl(status.url) : ''
  document.body.classList.toggle('meeting-live', Boolean(detectedCode))
  if (!status.open || !status.url || !detectedCode) {
    meetReady = false
    meetStatus.textContent = status.open
      ? 'Create or join a meeting in Meet to enable recording.'
      : 'Meet opens in the panel on the right →'
    updateReadiness()
    return
  }

  meetAccountEmail = (await window.careRecorder.getMeetAccountEmail()) || ''
  const accountMismatch = Boolean(
    hostEmail && meetAccountEmail && meetAccountEmail.toLowerCase() !== hostEmail.toLowerCase()
  )
  meetReady = Boolean(status.ready) && !accountMismatch
  const shortUrl = status.url.replace('https://', '')
  meetStatus.textContent = 'Meeting detected — recording is available.'

  if (accountMismatch) {
    meetStatus.textContent = `Switch Meet to ${hostEmail}. It is currently using ${meetAccountEmail}.`
  } else if (hostEmail) {
    meetStatus.textContent = `Meeting detected for ${hostEmail} — recording is available.`
  }

  if (detectedCode !== lastDetectedMeetingCode) {
    const selectedCode =
      selectedCalendarMeeting?.meetingCode?.toLowerCase() ||
      meetingCodeFromUrl(selectedCalendarMeeting?.hangoutLink || '')
    if (selectedCode !== detectedCode) {
      selectedCalendarMeeting = null
      calendarMeetingSelect.value = ''
      meetingTitleInput.value = `Meet ${detectedCode}`
      heroMeetingBadge.classList.remove('hidden')
      heroMeetingBadge.textContent = 'Meeting detected'
      heroMeetingTitle.textContent = status.title && !/^google meet$/i.test(status.title)
        ? status.title
        : `Meet ${detectedCode}`
      heroMeetingTime.textContent = 'Opened directly in Google Meet'
      heroMeetingLink.textContent = shortUrl
      updateFoldSummaries()
    }

    const expanded = await window.careRecorder.getSidebarExpanded()
    if (!expanded) await setSidebarExpanded(true)
    lastDetectedMeetingCode = detectedCode
  }

  updateReadiness()
}

function startMeetAwareness(): void {
  if (meetAwarenessTimerId !== null) window.clearInterval(meetAwarenessTimerId)
  meetAwarenessTimerId = window.setInterval(() => {
    if (uiState === 'idle') void refreshMeetStatus()
  }, 1500)
}

async function loadCalendarMeetings(): Promise<void> {
  if (!hostEmail) {
    renderCalendarMeetings()
    return
  }

  calendarStatus.textContent = 'Loading your calendar...'

  try {
    calendarMeetings = await window.careRecorder.getCalendarMeetings()
    renderCalendarMeetings()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    calendarStatus.textContent = message
    const option = document.createElement('option')
    option.value = ''
    option.textContent = message
    calendarMeetingSelect.replaceChildren(option)
    applyCalendarMeeting(null)
  }
}

async function loadSources(): Promise<void> {
  sources = await window.careRecorder.getCaptureSources()
  sourceSelect.innerHTML = ''

  const list =
    captureMode === 'screen'
      ? sources.filter((source) => Boolean(source.displayId))
      : sources.filter((source) => !source.displayId)

  if (list.length === 0) {
    sourceSelect.innerHTML = '<option value="">No capture sources found</option>'
    return
  }

  for (const source of list) {
    const option = document.createElement('option')
    option.value = source.id
    option.textContent = source.name
    sourceSelect.appendChild(option)
  }

  const meetSource = list.find((source) => /meet\.google\.com|Google Meet/i.test(source.name))
  if (meetSource) {
    sourceSelect.value = meetSource.id
  }

  updateSourcePreview(list.find((source) => source.id === sourceSelect.value))
}

async function refreshDriveDestination(
  destination: DriveDestination | null = currentDriveDestination
): Promise<void> {
  currentDriveDestination = destination
  driveFolderSelected = Boolean(destination?.folderId)

  if (destination?.pathLabel) {
    driveFolderLabel.textContent = destination.pathLabel
    meetingDriveFolderLabel.textContent = destination.pathLabel
    driveDestinationHint.textContent = 'Each session gets its own subfolder here.'
    meetingDriveDestinationHint.textContent = 'Verified — this meeting will upload here after processing.'
    chooseDriveFolderButton.textContent = 'Change'
    clearDriveFolderButton.classList.remove('hidden')
    meetingClearDriveFolderButton.classList.remove('hidden')
  } else {
    driveFolderLabel.textContent = 'Not selected'
    meetingDriveFolderLabel.textContent = 'Not selected'
    driveDestinationHint.textContent = 'Optional — uploads after each session.'
    chooseDriveFolderButton.textContent = 'Browse Google Drive…'
    clearDriveFolderButton.classList.add('hidden')
    void refreshDriveDestination(null)
    meetingClearDriveFolderButton.classList.add('hidden')
  }

  updateAfterPromise()
  updateFoldSummaries()
  setCaptureStatusLine(
    statusDrive,
    'Google Drive',
    destination?.folderId ? 'live' : 'idle',
    destination?.folderId ? 'Ready' : 'Local only'
  )
  void updateAppStatusBar()
}

async function refreshRecordingsPath(dir?: string): Promise<void> {
  const path = dir ?? (await window.careRecorder.getConfig()).recordingsDir
  recordingsPath.textContent = path
  recordingsPathHint.textContent = recordingsDirLocked
    ? 'Set by your IT team.'
    : 'Saved to your Videos folder by default.'
  changeRecordingsDirButton.disabled = recordingsDirLocked || uiState !== 'idle'
}

async function openDriveFolderPicker(): Promise<void> {
  chooseDriveFolderButton.disabled = true
  meetingChooseDriveFolderButton.disabled = true
  try {
    const picked = await window.careRecorder.pickDriveFolder()
    if (!picked) return

    const verified = await window.careRecorder.setDriveDestination(picked)
    await refreshDriveDestination(verified)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(message)
  } finally {
    chooseDriveFolderButton.disabled = !hostEmail || uiState !== 'idle'
    meetingChooseDriveFolderButton.disabled = !hostEmail || uiState !== 'idle'
  }
}

async function refreshAuthStatus(): Promise<void> {
  const status = await window.careRecorder.getAuthStatus()
  hostEmail = status.email || ''
  hostDisplayName = status.name || ''
  authStatus.textContent = status.authenticated
    ? `Signed in as ${status.email || 'Google user'}`
    : 'Not connected'
  authButton.textContent = status.authenticated ? 'Refresh access' : 'Sign in'
  signOutButton.classList.toggle('hidden', !status.authenticated)
  signOutButton.disabled = !status.authenticated || uiState !== 'idle'
  if (!authStateInitialized) {
    settingsDetails.open = !status.authenticated
    showPanelView(status.authenticated ? 'primary' : 'settings')
    authStateInitialized = true
  }
  chooseDriveFolderButton.disabled = !status.authenticated || uiState !== 'idle'
  meetingChooseDriveFolderButton.disabled = !status.authenticated || uiState !== 'idle'

  if (status.authenticated) {
    await Promise.all([loadCalendarMeetings(), refreshDriveDestination()])
  } else {
    hostEmail = ''
    hostDisplayName = ''
    currentDriveDestination = null
    calendarMeetings = []
    renderCalendarMeetings()
    driveFolderSelected = false
    driveFolderLabel.textContent = 'Not selected'
    driveDestinationHint.textContent = 'Optional — uploads after each session.'
    chooseDriveFolderButton.textContent = 'Browse Google Drive…'
    clearDriveFolderButton.classList.add('hidden')
  }

  updateFoldSummaries()
  void updateAppStatusBar()
}

function pickRecorderMimeType(hasAudio: boolean): string {
  const candidates = hasAudio
    ? [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8',
        'video/webm'
      ]
    : ['video/webm;codecs=vp8', 'video/webm']
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function stopCaptionHealthMonitor(): void {
  if (captionHealthTimerId !== null) {
    window.clearInterval(captionHealthTimerId)
    captionHealthTimerId = null
  }
  captionHealth.classList.add('hidden')
  captionHealth.textContent = ''
  captionHealth.classList.remove('ok', 'warn')
}

async function updateCaptionHealth(): Promise<void> {
  const status = await window.careRecorder.getMeetCaptionStatus()
  captionHealth.classList.remove('hidden', 'ok', 'warn')

  if (!status.on && !status.regionFound) {
    captionHealth.textContent =
      'Captions off — click CC in Meet (bottom bar) and enable speaker names in caption settings.'
    captionHealth.classList.add('warn')
    return
  }

  if (!status.regionFound) {
    captionHealth.textContent =
      'CC may be on — open the captions panel in Meet (bottom bar) so the app can read them.'
    captionHealth.classList.add('warn')
    return
  }

  if (status.linesCaptured === 0 && status.visibleRows === 0) {
    captionHealth.textContent = 'Waiting for captions — turn on CC in Meet and speak to test.'
    captionHealth.classList.add('warn')
    return
  }

  if (!status.hasSpeakerNames) {
    captionHealth.textContent = `${status.linesCaptured} lines — enable speaker names in Meet.`
    captionHealth.classList.add('warn')
    return
  }

  captionHealth.textContent = `${status.linesCaptured} lines captured with names.`
  captionHealth.classList.add('ok')
}

function startCaptionHealthMonitor(): void {
  stopCaptionHealthMonitor()
  void updateCaptionHealth()
  captionHealthTimerId = window.setInterval(() => {
    void updateCaptionHealth()
  }, 2000)
}

function startSessionTimer(): void {
  recordingClockStart = Date.now()
  stopSessionTimer()
  recordingTimerId = window.setInterval(() => {
    recordingTimer.textContent = formatElapsed(Date.now() - recordingClockStart)
  }, 1000)
  recordingTimer.textContent = '00:00'
}

function stopSessionTimer(): void {
  if (recordingTimerId !== null) {
    window.clearInterval(recordingTimerId)
    recordingTimerId = null
  }
  stopCaptionHealthMonitor()
}

async function acquireMicStream(): Promise<MediaStream> {
  const access = await window.careRecorder.ensureMicrophoneAccess()
  if (!access.granted) {
    throw new Error(access.message || 'Microphone access is required to record your voice.')
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      },
      video: false
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await window.careRecorder.markMicrophoneDenied()
    const retry = window.confirm(
      `Could not open your microphone (${detail}).\n\nReset the app's microphone choice and try again?`
    )
    if (retry) {
      await window.careRecorder.resetMicrophonePermissions()
      await initializeMicrophoneOnStartup()
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        },
        video: false
      })
    }
    throw new Error(
      `Could not open your microphone (${detail}). Check Windows microphone settings for CARE Meet Companion.`
    )
  }
}

async function initializeMicrophoneOnStartup(): Promise<void> {
  const init = await window.careRecorder.initializeMicrophone()
  if (init.status === 'granted') {
    return
  }

  if (init.status === 'denied') {
    return
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: true
      },
      video: false
    })
    for (const track of stream.getTracks()) {
      track.stop()
    }
    await window.careRecorder.confirmMicrophoneGranted()
  } catch {
    await window.careRecorder.markMicrophoneDenied()
  }
}

async function acquireDisplayCapture(includeDisplayAudio = true): Promise<MediaStream> {
  if (captureMode !== 'meet-tab') {
    const selected = sources.find((source) => source.id === sourceSelect.value)
    if (!selected) {
      throw new Error('Select a window or screen to record.')
    }
    await window.careRecorder.setCaptureSource(selected.id)
  }

  const prepared = await window.careRecorder.prepareCapture()
  if (!prepared.ready) {
    throw new Error(prepared.message || 'Capture is not ready.')
  }

  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: includeDisplayAudio
        ? ({
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false
          } as MediaTrackConstraints)
        : false
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Could not start screen capture. ${message} Try restarting the app or use "Browser window" capture mode.`
    )
  }
}

function composeRecordingStream(
  displayStream: MediaStream,
  audioTracks: MediaStreamTrack[]
): MediaStream {
  return new MediaStream([...displayStream.getVideoTracks(), ...audioTracks])
}

async function buildRecordingStreamFromDisplay(displayStream: MediaStream): Promise<MediaStream> {
  if (!micStream) {
    micStream = await acquireMicStream()
  }

  const displayAudio = displayStream.getAudioTracks()
  const micAudio = micStream.getAudioTracks()

  if (displayStream.getVideoTracks().length === 0) {
    throw new Error('Video preflight failed: no meeting video source is available.')
  }
  if (displayAudio.length === 0) {
    throw new Error(
      captureMode === 'meet-tab'
        ? 'Audio preflight failed: participant audio is not available from the Meet tab. Restart the app and try a short test recording.'
        : 'Audio preflight failed: Windows did not provide system audio for the selected source. Try Screen capture or check Windows audio output.'
    )
  }
  if (micAudio.length === 0) {
    throw new Error('Audio preflight failed: your microphone is not available.')
  }

  let audioTracks: MediaStreamTrack[] = []
  // Meet-tab audio contains remote participants; other modes use Windows loopback.
  // Both that source and the microphone passed preflight above.
  audioTracks = await mixAudioTracks(displayAudio, micAudio)

  for (const track of audioTracks) {
    track.enabled = true
  }

  if (audioTracks.length === 0) {
    throw new Error(
      captureMode === 'meet-tab'
        ? 'Microphone access is needed to record your voice. Allow the mic when prompted, then try again.'
        : 'No audio was detected. Allow microphone access when prompted, then try again.'
    )
  }

  const stream = composeRecordingStream(displayStream, audioTracks)
  if (!stream.getVideoTracks().length) {
    throw new Error('No video capture track is active. Keep the meeting visible in the app.')
  }

  return stream
}

async function mixAudioTracks(
  displayAudio: MediaStreamTrack[],
  micAudio: MediaStreamTrack[]
): Promise<MediaStreamTrack[]> {
  if (displayAudio.length > 0 && micAudio.length === 0) {
    return displayAudio
  }

  if (micAudio.length > 0 && displayAudio.length === 0) {
    return micAudio
  }

  if (displayAudio.length === 0 && micAudio.length === 0) {
    return []
  }

  const audioContext = new AudioContext({ sampleRate: 48000 })
  await audioContext.resume()
  const destination = audioContext.createMediaStreamDestination()

  const displaySource = audioContext.createMediaStreamSource(new MediaStream(displayAudio))
  const micSource = audioContext.createMediaStreamSource(new MediaStream(micAudio))
  participantAnalyser = audioContext.createAnalyser()
  microphoneAnalyser = audioContext.createAnalyser()
  participantAnalyser.fftSize = 512
  microphoneAnalyser.fftSize = 512
  const displayGain = audioContext.createGain()
  const micGain = audioContext.createGain()
  displayGain.gain.value = 1
  micGain.gain.value = 1

  displaySource.connect(participantAnalyser)
  participantAnalyser.connect(displayGain)
  micGain.connect(destination)
  displayGain.connect(destination)
  micSource.connect(microphoneAnalyser)
  microphoneAnalyser.connect(micGain)
  recordingAudioContext = audioContext
  return destination.stream.getAudioTracks()
}

async function createMediaRecorderForStream(stream: MediaStream): Promise<void> {
  const hasAudio = stream.getAudioTracks().length > 0
  const mimeType = pickRecorderMimeType(hasAudio)
  if (!mimeType) {
    throw new Error('This computer cannot record video in a supported format.')
  }

  mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 1_500_000,
    ...(hasAudio ? { audioBitsPerSecond: 128_000 } : {})
  })

  mediaRecorder.onerror = () => {
    console.error('MediaRecorder error during capture')
    void handleCaptureFailure('The recording encoder reported an error.')
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size === 0 || !sessionId) return
    void event.data.arrayBuffer().then((buffer) => {
      void queueRecordingChunk(buffer, false)
    })
  }

  mediaRecorder.start(RECORDER_SLICE_MS)
}

async function waitForFirstChunk(timeoutMs: number): Promise<boolean> {
  const baseline = recordingBytesReceived
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (recordingBytesReceived > baseline) return true
    await new Promise((resolve) => window.setTimeout(resolve, 250))
  }
  return recordingBytesReceived > baseline
}

async function startRecorderWithVerification(): Promise<MediaStream> {
  if (captureMode === 'meet-tab') {
    await window.careRecorder.configureMeetTabCapture({ includeAudio: true })
  }

  const displayStream = await acquireDisplayCapture(true)
  const stream = await buildRecordingStreamFromDisplay(displayStream)
  recordingStream = stream
  attachCaptureTrackGuards(stream)
  const videoSettings = stream.getVideoTracks()[0]?.getSettings()
  const videoDetail = videoSettings?.width && videoSettings?.height
    ? `${videoSettings.width}×${videoSettings.height}${videoSettings.frameRate ? ` · ${Math.round(videoSettings.frameRate)} fps` : ''}`
    : 'Live'
  setCaptureStatusLine(statusVideo, 'Video', 'live', videoDetail)

  await verifyAudioSignals()
  await runRecordingCountdown()

  await createMediaRecorderForStream(stream)

  if (!(await waitForFirstChunk(3500))) {
    throw new Error(
      'Video capture did not start. Restart the app, allow the microphone, and keep the meeting visible on the right.'
    )
  }

  return stream
}

function subscribeMeetCallEnded(): void {
  meetEndedUnsubscribe?.()
  meetEndedUnsubscribe = window.careRecorder.onMeetCallEnded(() => {
    if (uiState !== 'recording' || sessionEnding) return
    const label = sessionMode === 'notes-only' ? 'notes' : 'recording'
    void endSession(`Meeting ended — saving your ${label}...`)
  })
}

function unsubscribeMeetCallEnded(): void {
  meetEndedUnsubscribe?.()
  meetEndedUnsubscribe = null
}

async function ensureMeetReady(): Promise<boolean> {
  const status = await window.careRecorder.getMeetStatus()
  if (!status.open || !meetingCodeFromUrl(status.url)) {
    window.alert('Open your meeting in this app before starting the recording.')
    return false
  }
  const activeMeetEmail = await window.careRecorder.getMeetAccountEmail()
  if (hostEmail && activeMeetEmail && activeMeetEmail.toLowerCase() !== hostEmail.toLowerCase()) {
    window.alert(
      `Google Meet is signed in as ${activeMeetEmail}. Switch Meet to ${hostEmail} before recording.`
    )
    return false
  }
  return true
}

async function confirmRecordingNotice(): Promise<boolean> {
  return recordingNoticeCheckbox.checked
}

async function startSession(): Promise<void> {
  sessionMode = getSessionMode()
  updateSessionModeUi()

  if (!(await confirmRecordingNotice())) return
  if (!currentDriveDestination) {
    const localOnly = window.confirm(
      'This meeting has no Google Drive destination. Record and keep the files only on this computer?'
    )
    if (!localOnly) return
  }

  if (getSessionMode() === 'record') {
    try {
      await verifyStorageBeforeRecording()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error))
      return
    }
  }

  const title =
    meetingTitleInput.value.trim() ||
    selectedCalendarMeeting?.title ||
    defaultMeetingTitle()
  meetingTitleInput.value = title
  startedAt = new Date().toISOString()
  chunkWriteChain = Promise.resolve()
  recordingBytesReceived = 0
  sessionEnding = false
  captureFailureReported = false

  try {
    if (sessionMode === 'notes-only' || captureMode === 'meet-tab') {
      if (!(await ensureMeetReady())) {
        cleanupStreams()
        return
      }
    }

    if (sessionMode === 'record') {
      setUiState('checking')
    }

    const session = await window.careRecorder.beginRecordingSession({
      title,
      startedAt,
      mode: sessionMode
    })
    sessionId = session.folderName

    if (sessionMode === 'record') {
      recordingStream = await startRecorderWithVerification()
      await window.careRecorder.setRecordingActive(true)
    }

    setUiState('recording')
    if (sessionMode === 'record') startStorageMonitor()
    subscribeMeetCallEnded()
    startSessionTimer()
    if (sessionMode === 'notes-only') {
      startCaptionHealthMonitor()
    }
  } catch (error) {
    setUiState('idle')
    const message = error instanceof Error ? error.message : String(error)
    const action = sessionMode === 'notes-only' ? 'start notes' : 'start recording'
    const micIssue = /microphone|mic/i.test(message)
    if (micIssue && window.confirm(`${message}\n\nOpen microphone settings now?`)) {
      await window.careRecorder.openMicrophoneSettings()
    } else {
      window.alert(`Unable to ${action}: ${message}`)
    }
    cleanupStreams()
    unsubscribeMeetCallEnded()
  }
}

function cleanupStreams(): void {
  stopSessionTimer()
  stopStorageMonitor()
  stopAudioMeters()
  void window.careRecorder.setRecordingActive(false)
  void window.careRecorder.configureMeetTabCapture({ includeAudio: true })
  if (recordingAudioContext) {
    void recordingAudioContext.close()
    recordingAudioContext = null
  }
  for (const track of recordingStream?.getTracks() || []) {
    track.stop()
  }
  for (const track of micStream?.getTracks() || []) {
    track.stop()
  }
  recordingStream = null
  micStream = null
  mediaRecorder = null
}

async function finalizeRecordingChunks(): Promise<void> {
  if (sessionMode !== 'record' || !mediaRecorder) {
    return
  }

  const recorder = mediaRecorder

  if (recorder.state === 'recording' || recorder.state === 'paused') {
    recorder.requestData()
    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        'stop',
        () => {
          window.setTimeout(() => {
            void queueRecordingChunk(new ArrayBuffer(0), true).then(resolve)
          }, 500)
        },
        { once: true }
      )
      recorder.stop()
    })
  } else {
    await queueRecordingChunk(new ArrayBuffer(0), true)
  }

  await chunkWriteChain
}

async function endSession(initialStatus = 'Stopping...'): Promise<void> {
  if (sessionEnding || uiState !== 'recording') {
    return
  }

  sessionEnding = true
  unsubscribeMeetCallEnded()
  setUiState('processing')
  stopButton.disabled = true
  setStatus(initialStatus)

  if (sessionMode === 'record') {
    await finalizeRecordingChunks()
    cleanupStreams()

    if (recordingBytesReceived === 0) {
      sessionEnding = false
      setStatus('No video captured')
      setUiState('error')
      window.alert(
        'No video was captured. Keep the meeting visible on the right, record for at least a few seconds, then stop again.'
      )
      return
    }
  } else {
    stopSessionTimer()
    void window.careRecorder.setRecordingActive(false)
  }

  progressUnsubscribe?.()
  progressUnsubscribe = window.careRecorder.onProcessingProgress((message) => {
    appendProgress(message)
  })

  try {
    const result = await window.careRecorder.startProcessing({
      sessionId,
      title: meetingTitleInput.value.trim() || defaultMeetingTitle(),
      startedAt,
      mode: sessionMode,
      hostEmail: hostEmail || undefined,
      hostDisplayName: hostDisplayName || undefined,
      participantNames: selectedCalendarMeeting?.attendeeNames,
      calendarEventId: selectedCalendarMeeting?.id,
      hangoutLink:
        selectedCalendarMeeting?.hangoutLink ||
        (lastDetectedMeetingCode ? `https://meet.google.com/${lastDetectedMeetingCode}` : undefined),
      meetingCode: selectedCalendarMeeting?.meetingCode || lastDetectedMeetingCode || undefined,
      driveDestination: currentDriveDestination
    })

    completeMessage.textContent = result.message
    setUiState('complete')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStatus('Something went wrong')
    setUiState('error')
    window.alert(message)
  } finally {
    progressUnsubscribe?.()
    progressUnsubscribe = null
    sessionEnding = false
  }
}

async function returnToLanding(options?: { clearSession?: boolean }): Promise<void> {
  const clearSession = options?.clearSession ?? (uiState === 'complete' || uiState === 'error')
  if (clearSession) {
    completeMessage.textContent = ''
    sessionId = ''
    startedAt = ''
    sessionEnding = false
    recordingNoticeCheckbox.checked = false
    currentDriveDestination = null
    driveFolderSelected = false
    void window.careRecorder.clearDriveDestination()
    void refreshDriveDestination(null)
    unsubscribeMeetCallEnded()
  }

  setUiState('idle')
  await window.careRecorder.closeMeet()
  document.body.classList.remove('meet-mode', 'meeting-live')
  showPanelView('primary')
  updateNavigationLabels()
  meetingDetails.classList.toggle('is-collapsed', false)
  settingsDetails.open = false
  lastDetectedMeetingCode = ''
  meetReady = false
  updateReadiness()
  void loadCalendarMeetings()
}

function resetForNewSession(): void {
  void returnToLanding({ clearSession: true })
}

returnSetupButton.addEventListener('click', () => {
  void (async () => {
    if (uiState === 'recording' || uiState === 'checking' || uiState === 'processing') return
    if (document.body.classList.contains('meeting-live')) {
      const leave = window.confirm('Close Google Meet and return to meeting setup?')
      if (!leave) return
    }
    await returnToLanding()
  })()
})

primaryTabButton.addEventListener('click', () => {
  showPanelView('primary')
})

settingsTabButton.addEventListener('click', () => {
  showPanelView('settings')
})

focusModeButton.addEventListener('click', () => {
  void (async () => {
    const expanded = await window.careRecorder.toggleSidebar()
    applySidebarUi(expanded)
  })()
})

expandPanelButton.addEventListener('click', () => {
  void setSidebarExpanded(true)
})

document.getElementById('focus-rail')?.addEventListener('click', (event) => {
  if (event.target === expandPanelButton) return
  void setSidebarExpanded(true)
})

captureModeSelect.addEventListener('change', () => {
  updateCaptureModeUi()
  void loadSources()
})

for (const input of sessionModeInputs) {
  input.addEventListener('change', () => {
    updateSessionModeUi()
  })
}

recordingNoticeCheckbox.addEventListener('change', () => {
  updateReadiness()
})

sourceSelect.addEventListener('change', () => {
  updateSourcePreview(sources.find((source) => source.id === sourceSelect.value))
})

calendarMeetingSelect.addEventListener('change', () => {
  const meeting = calendarMeetings.find((item) => item.id === calendarMeetingSelect.value) || null
  applyCalendarMeeting(meeting)
})

openMeetButton.addEventListener('click', () => {
  void (async () => {
    if (!currentDriveDestination) {
      const localOnly = window.confirm(
        'No Google Drive folder is selected for this meeting. Continue with a local-only recording?'
      )
      if (!localOnly) return
    }
    openMeetButton.disabled = true
    meetStatus.textContent = 'Opening Meet...'
    await window.careRecorder.openMeet(getMeetUrl())
    document.body.classList.add('meet-mode')
    showPanelView('primary')
    updateNavigationLabels()
    meetingDetails.classList.add('is-collapsed')
    settingsDetails.open = false
    await refreshMeetStatus()
    openMeetButton.disabled = uiState !== 'idle'
  })()
})

openMeetBrowserButton.addEventListener('click', () => {
  void window.careRecorder.openMeetInBrowser(getMeetUrl())
})

copyMeetLinkButton.addEventListener('click', () => {
  void navigator.clipboard.writeText(getMeetUrl()).then(() => {
    const previous = copyMeetLinkButton.textContent
    copyMeetLinkButton.textContent = 'Copied'
    window.setTimeout(() => {
      copyMeetLinkButton.textContent = previous || 'Copy link'
    }, 1500)
  })
})

meetingTitleInput.addEventListener('input', () => {
  if (!selectedCalendarMeeting) {
    heroMeetingTitle.textContent = meetingTitleInput.value.trim() || 'Name your meeting'
  }
  updateFoldSummaries()
})

startButton.addEventListener('click', () => {
  void startSession()
})

stopButton.addEventListener('click', () => {
  void endSession(sessionMode === 'notes-only' ? 'Saving your notes...' : 'Stopping recording...')
})

hideToTrayButton.addEventListener('click', () => {
  void window.careRecorder.hideToTray()
})

newRecordingButton.addEventListener('click', () => {
  resetForNewSession()
})

authButton.addEventListener('click', () => {
  void (async () => {
    authButton.disabled = true
    authStatus.textContent = 'Opening Google sign-in...'
    const result = await window.careRecorder.startGoogleAuth()
    if (!result.success) {
      authStatus.textContent = result.error || 'Google sign-in failed'
    } else {
      showPanelView('primary')
    }
    await refreshAuthStatus()
    await refreshMeetStatus()
    authButton.disabled = uiState === 'recording' || uiState === 'processing'
  })()
})

refreshCalendarButton.addEventListener('click', () => {
  void loadCalendarMeetings()
})

openFolderButton.addEventListener('click', () => {
  window.careRecorderExtras.openRecordingsFolder()
})

signOutButton.addEventListener('click', () => {
  void (async () => {
    if (!window.confirm('Sign out of CARE Meet Companion?')) return
    authButton.disabled = true
    signOutButton.disabled = true
    await window.careRecorder.signOutGoogle()
    await refreshAuthStatus()
    showPanelView('settings')
    authButton.disabled = uiState !== 'idle'
  })()
})

calendarMeetingList.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-meeting-id]')
  if (!button) return
  const meeting = calendarMeetings.find((item) => item.id === button.dataset.meetingId) || null
  if (!meeting) return
  calendarMeetingSelect.value = meeting.id
  for (const item of calendarMeetingList.querySelectorAll('.meeting-event')) {
    item.classList.toggle('selected', item === button)
    item.setAttribute('aria-pressed', String(item === button))
  }
  applyCalendarMeeting(meeting)
})

errorOpenFolderButton.addEventListener('click', () => {
  window.careRecorderExtras.openRecordingsFolder()
})

changeRecordingsDirButton.addEventListener('click', () => {
  void (async () => {
    if (recordingsDirLocked || uiState !== 'idle') return
    try {
      const chosen = await window.careRecorder.chooseRecordingsDir()
      if (chosen) {
        await refreshRecordingsPath(chosen)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      window.alert(message)
    }
  })()
})

chooseDriveFolderButton.addEventListener('click', () => {
  void openDriveFolderPicker()
})

meetingChooseDriveFolderButton.addEventListener('click', () => {
  void openDriveFolderPicker()
})

clearDriveFolderButton.addEventListener('click', () => {
  void (async () => {
    await window.careRecorder.clearDriveDestination()
    await refreshDriveDestination(null)
  })()
})

meetingClearDriveFolderButton.addEventListener('click', () => {
  void (async () => {
    await window.careRecorder.clearDriveDestination()
    await refreshDriveDestination(null)
  })()
})

appUpdateAction.addEventListener('click', () => {
  void window.careRecorder.installAppUpdate()
})

checkUpdatesButton.addEventListener('click', () => {
  void (async () => {
    checkUpdatesButton.disabled = true
    updateStatus.textContent = 'Checking for updates…'
    const result = await window.careRecorder.checkForUpdates()
    showAppUpdate(result)
    checkUpdatesButton.disabled = false
  })()
})

async function bootstrap(): Promise<void> {
  meetingTitleInput.value = defaultMeetingTitle()
  subscribeSidebarChanges()
  subscribeAppUpdates()
  appVersion = await window.careRecorder.getAppVersion()
  const sidebarExpanded = await window.careRecorder.getSidebarExpanded()
  applySidebarUi(sidebarExpanded)
  await initializeMicrophoneOnStartup()
  const config = await window.careRecorder.getConfig()
  transcriptionReady = config.transcriptionReady
  recordingsDirLocked = config.recordingsDirLocked
  await refreshRecordingsPath(config.recordingsDir)
  updateAfterPromise()
  updateSessionModeUi()
  updateCaptureModeUi()
  await Promise.all([loadSources(), refreshAuthStatus(), refreshMeetStatus(), refreshDriveDestination()])
  updateFoldSummaries()
  const micStatus = await window.careRecorder.getMicrophonePermissionStatus()
  if (micStatus.status === 'denied') {
    updateReadyStatus('Microphone declined — reset permissions to record your voice')
  }
  setUiState('idle')
  void refreshStorageHealth().catch(() => {
    storageHealth.textContent = 'Recording storage is unavailable'
    storageHealth.classList.add('warn')
  })
  startMeetAwareness()
}

void bootstrap()
