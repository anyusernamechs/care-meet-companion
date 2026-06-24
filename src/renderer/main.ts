import type {
  AppUpdateEvent,
  CalendarMeeting,
  CaptureMode,
  CaptureSource,
  SessionMode
} from '../shared/types'

type UIState = 'idle' | 'recording' | 'processing' | 'complete' | 'error'

const meetingTitleInput = document.getElementById('meeting-title') as HTMLInputElement
const captureModeSelect = document.getElementById('capture-mode-select') as HTMLSelectElement
const sourcePicker = document.getElementById('source-picker') as HTMLElement
const sourceSelect = document.getElementById('source-select') as HTMLSelectElement
const sourcePreview = document.getElementById('source-preview') as HTMLElement
const sourceThumbnail = document.getElementById('source-thumbnail') as HTMLImageElement
const sourceName = document.getElementById('source-name') as HTMLParagraphElement
const startButton = document.getElementById('start-button') as HTMLButtonElement
const stopButton = document.getElementById('stop-button') as HTMLButtonElement
const sessionReady = document.getElementById('session-ready') as HTMLElement
const sessionActive = document.getElementById('session-active') as HTMLElement
const sessionProcessing = document.getElementById('session-processing') as HTMLElement
const readyStatusText = document.getElementById('ready-status-text') as HTMLParagraphElement
const recordingTimer = document.getElementById('recording-timer') as HTMLParagraphElement
const statusVideo = document.getElementById('status-video') as HTMLLIElement
const statusAudio = document.getElementById('status-audio') as HTMLLIElement
const statusTranscript = document.getElementById('status-transcript') as HTMLLIElement
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement
const completeCard = document.getElementById('complete-card') as HTMLElement
const completeMessage = document.getElementById('complete-message') as HTMLParagraphElement
const newRecordingButton = document.getElementById('new-recording-button') as HTMLButtonElement
const authStatus = document.getElementById('auth-status') as HTMLParagraphElement
const authButton = document.getElementById('auth-button') as HTMLButtonElement
const openFolderButton = document.getElementById('open-folder-button') as HTMLButtonElement
const recordingsPath = document.getElementById('recordings-path') as HTMLParagraphElement
const recordingsPathHint = document.getElementById('recordings-path-hint') as HTMLParagraphElement
const changeRecordingsDirButton = document.getElementById(
  'change-recordings-dir-button'
) as HTMLButtonElement
const calendarStatus = document.getElementById('calendar-status') as HTMLParagraphElement
const calendarMeetingSelect = document.getElementById('calendar-meeting-select') as HTMLSelectElement
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
const recordSourceOptions = document.getElementById('record-source-options') as HTMLElement
const notesOnlyHint = document.getElementById('notes-only-hint') as HTMLElement
const captionReminder = document.getElementById('caption-reminder') as HTMLElement
const captionHealth = document.getElementById('caption-health') as HTMLParagraphElement
const recordingNoticeCheckbox = document.getElementById('recording-notice-checkbox') as HTMLInputElement
const afterPromiseList = document.getElementById('after-promise-list') as HTMLUListElement
const appStatusBarText = document.getElementById('app-status-bar-text') as HTMLParagraphElement
const appUpdateBar = document.getElementById('app-update-bar') as HTMLElement
const appUpdateText = document.getElementById('app-update-text') as HTMLParagraphElement
const appUpdateAction = document.getElementById('app-update-action') as HTMLButtonElement
const meetingFoldSummary = document.getElementById('meeting-fold-summary') as HTMLSpanElement
const settingsFoldSummary = document.getElementById('settings-fold-summary') as HTMLSpanElement
const settingsDetails = document.getElementById('settings-details') as HTMLDetailsElement
const focusModeButton = document.getElementById('focus-mode-button') as HTMLButtonElement
const expandPanelButton = document.getElementById('expand-panel-button') as HTMLButtonElement
const sessionModeInputs = document.querySelectorAll(
  'input[name="session-mode"]'
) as NodeListOf<HTMLInputElement>

let transcriptionReady = false
let driveFolderSelected = false
let recordingsDirLocked = false
let appVersion = ''

let sources: CaptureSource[] = []
let calendarMeetings: CalendarMeeting[] = []
let selectedCalendarMeeting: CalendarMeeting | null = null
let captureMode: CaptureMode = 'meet-tab'
let sessionMode: SessionMode = 'record'
let hostEmail = ''
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

const RECORDER_SLICE_MS = 2000

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
        console.warn(`Capture ${track.kind} track ended during recording`)
      }
    })
  }
}

function getMeetUrl(): string {
  return (
    selectedCalendarMeeting?.hangoutLink ||
    (selectedCalendarMeeting?.meetingCode
      ? `https://meet.google.com/${selectedCalendarMeeting.meetingCode}`
      : 'https://meet.google.com')
  )
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
  state: 'live' | 'off' | 'idle'
): void {
  element.className = state
  const stateLabel = state === 'live' ? 'capturing' : state === 'idle' ? 'live' : 'off'
  element.innerHTML = `<span class="dot"></span>${label}: ${stateLabel}`
}

function updateCaptureStatuses(state: 'idle' | 'recording' | 'notes'): void {
  if (state === 'idle') {
    setCaptureStatusLine(statusVideo, 'Video', 'off')
    setCaptureStatusLine(statusAudio, 'Audio', 'off')
    setCaptureStatusLine(statusTranscript, 'Transcript', 'off')
    return
  }

  if (state === 'notes') {
    setCaptureStatusLine(statusVideo, 'Video', 'off')
    setCaptureStatusLine(statusAudio, 'Audio', 'off')
    setCaptureStatusLine(statusTranscript, 'Transcript', 'live')
    return
  }

  setCaptureStatusLine(statusVideo, 'Video', 'live')
  setCaptureStatusLine(statusAudio, 'Audio', 'live')
  setCaptureStatusLine(statusTranscript, 'Transcript', 'live')
}

function updateReadyStatus(text: string): void {
  readyStatusText.textContent = text
}

function updateAfterPromise(): void {
  const notesOnly = getSessionMode() === 'notes-only'
  const items = notesOnly
    ? ['Save transcript with names', 'Upload to Google Drive']
    : ['Save MP4', 'Create transcript', 'Upload to Google Drive']

  if (!driveFolderSelected) {
    const uploadIndex = items.findIndex((item) => item.startsWith('Upload'))
    if (uploadIndex >= 0) {
      items[uploadIndex] = 'Keep local copy (no Google Drive folder selected)'
    }
  }

  afterPromiseList.innerHTML = items.map((item) => `<li>${item}</li>`).join('')
}

function updateFoldSummaries(): void {
  const meetingTitle =
    selectedCalendarMeeting?.title || meetingTitleInput.value.trim() || 'Join or pick from calendar'
  meetingFoldSummary.textContent = meetingTitle

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

function updateSettingsFoldState(): void {
  if (settingsDetails && !hostEmail) {
    settingsDetails.open = true
  }
}

async function updateAppStatusBar(): Promise<void> {
  const warnings: string[] = []

  if (!hostEmail) {
    warnings.push('Sign in to Google')
  } else if (!driveFolderSelected) {
    warnings.push('Choose a Drive folder')
  }

  if (!transcriptionReady) {
    warnings.push('Transcript tools unavailable')
  }

  if (warnings.length) {
    appStatusBarText.textContent = warnings.join(' · ')
    appStatusBarText.classList.add('warn')
  } else {
    appStatusBarText.textContent = appVersion ? `Ready to record · v${appVersion}` : 'Ready to record'
    appStatusBarText.classList.remove('warn')
  }
}

function showAppUpdate(event: AppUpdateEvent): void {
  if (event.status === 'checking' || event.status === 'not-available' || event.status === 'error') {
    if (event.status === 'error') {
      logUpdateError(event.message)
    }
    return
  }

  appUpdateBar.classList.remove('hidden')

  if (event.status === 'available' || event.status === 'downloading') {
    appUpdateText.textContent =
      event.status === 'downloading'
        ? `Downloading update v${event.version ?? ''}…`
        : `Update v${event.version ?? ''} available — downloading in the background`
    appUpdateAction.classList.add('hidden')
    return
  }

  if (event.status === 'downloaded') {
    appUpdateText.textContent = `Update v${event.version ?? ''} is ready`
    appUpdateAction.classList.remove('hidden')
  }
}

function logUpdateError(message?: string): void {
  if (!message) return
  console.warn('[care:update]', message)
}

function subscribeAppUpdates(): void {
  window.careRecorder.onAppUpdate((event) => {
    showAppUpdate(event)
  })
}

function setUiState(state: UIState): void {
  uiState = state

  const idle = state === 'idle'
  const recording = state === 'recording'
  const processing = state === 'processing' || state === 'error'
  const complete = state === 'complete'

  startButton.classList.toggle('hidden', !idle)
  stopButton.classList.toggle('hidden', !recording)
  stopButton.disabled = !recording

  sessionReady.classList.add('hidden')
  sessionActive.classList.toggle('hidden', !recording)
  sessionProcessing.classList.toggle('hidden', !processing)

  completeCard.classList.toggle('hidden', !complete)

  if (idle) {
    updateCaptureStatuses('idle')
  }

  if (recording) {
    updateCaptureStatuses(getSessionMode() === 'notes-only' ? 'notes' : 'recording')
  }

  meetingTitleInput.disabled = !idle
  captureModeSelect.disabled = !idle || sessionMode === 'notes-only'
  sourceSelect.disabled = !idle
  calendarMeetingSelect.disabled = !idle || !hostEmail
  refreshCalendarButton.disabled = !idle || !hostEmail
  openMeetButton.disabled = !idle
  openMeetBrowserButton.disabled = !idle
  copyMeetLinkButton.disabled = !idle
  authButton.disabled = state === 'recording' || state === 'processing'
  chooseDriveFolderButton.disabled = !hostEmail || state !== 'idle'
  changeRecordingsDirButton.disabled = recordingsDirLocked || state !== 'idle'
  recordingNoticeCheckbox.disabled = !idle
  for (const input of sessionModeInputs) {
    input.disabled = !idle
  }
  updateSessionModeUi()
  void updateAppStatusBar()
}

const FRIENDLY_PROGRESS = new Set([
  'Recording...',
  'Taking notes...',
  'Stopping recording...',
  'Saving your notes...',
  'Saving your video...',
  'Writing the transcript...',
  'Writing the transcript… this may take several minutes for long meetings.',
  'Saving transcript with participant names...',
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
    message.startsWith('Saving transcript')
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
  const show = getSessionMode() === 'notes-only' || captureMode === 'meet-tab'
  captionReminder.classList.toggle('hidden', !show)
}

function updateSessionModeUi(): void {
  sessionMode = getSessionMode()
  const notesOnly = sessionMode === 'notes-only'

  recordSourceOptions.classList.toggle('hidden', notesOnly)
  notesOnlyHint.classList.toggle('hidden', !notesOnly)
  updateCaptionReminder()
  startButton.textContent = notesOnly ? 'Start notes' : 'Start recording'
  stopButton.textContent = notesOnly ? 'Stop and save notes' : 'Stop and upload'

  if (notesOnly && captureMode !== 'meet-tab') {
    captureModeSelect.value = 'meet-tab'
    updateCaptureModeUi()
  }

  captureModeSelect.disabled = notesOnly || uiState !== 'idle'
  updateAfterPromise()

  if (uiState === 'idle') {
    updateReadyStatus(notesOnly ? 'Ready to take notes' : 'Ready to record')
  }
}

function updateCaptureModeUi(): void {
  captureMode = captureModeSelect.value as CaptureMode
  sourcePicker.classList.toggle('hidden', captureMode === 'meet-tab')
  updateCaptionReminder()
  void window.careRecorder.setCaptureMode(captureMode)
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

  if (!meeting) {
    heroMeetingBadge.classList.add('hidden')
    heroMeetingTitle.textContent = meetingTitleInput.value.trim() || 'Name your meeting'
    heroMeetingTime.textContent = hostEmail ? 'No upcoming Meet on your calendar' : 'Sign in to load calendar'
    heroMeetingLink.textContent = getMeetLinkDisplay()
    copyMeetLinkButton.disabled = uiState !== 'idle'
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
  copyMeetLinkButton.disabled = uiState !== 'idle'
  updateFoldSummaries()
}

function renderCalendarMeetings(): void {
  calendarMeetingSelect.innerHTML = ''

  if (!hostEmail) {
    calendarMeetingSelect.innerHTML = '<option value="">Connect Google to see your meetings</option>'
    calendarStatus.textContent = 'Sign in to load your personal calendar'
    applyCalendarMeeting(null)
    return
  }

  if (calendarMeetings.length === 0) {
    calendarMeetingSelect.innerHTML = '<option value="">No Meet events in the next 24 hours</option>'
    calendarStatus.textContent = 'No Google Meet events in the next 24 hours'
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
  }

  const current = calendarMeetings.find((meeting) => meeting.isActive) || calendarMeetings[0]
  calendarMeetingSelect.value = current.id
  applyCalendarMeeting(current)
}

async function refreshMeetStatus(): Promise<void> {
  const status = await window.careRecorder.getMeetStatus()
  if (!status.open || !status.url) {
    meetStatus.textContent = 'Meet opens in the panel on the right →'
    return
  }

  const shortUrl = status.url.replace('https://', '')
  meetStatus.textContent = status.title ? `Open: ${status.title}` : `Open: ${shortUrl}`
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

async function refreshDriveDestination(): Promise<void> {
  const destination = await window.careRecorder.getDriveDestination()
  driveFolderSelected = Boolean(destination?.pathLabel)

  if (destination?.pathLabel) {
    driveFolderLabel.textContent = destination.pathLabel
    driveDestinationHint.textContent = 'Each session gets its own subfolder here.'
    chooseDriveFolderButton.textContent = 'Change'
    clearDriveFolderButton.classList.remove('hidden')
  } else {
    driveFolderLabel.textContent = 'Not selected'
    driveDestinationHint.textContent = 'Optional — uploads after each session.'
    chooseDriveFolderButton.textContent = 'Browse Google Drive…'
    clearDriveFolderButton.classList.add('hidden')
  }

  updateAfterPromise()
  updateFoldSummaries()
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
  try {
    const picked = await window.careRecorder.pickDriveFolder()
    if (!picked) return

    await window.careRecorder.setDriveDestination(picked)
    await refreshDriveDestination()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    window.alert(message)
  } finally {
    chooseDriveFolderButton.disabled = !hostEmail || uiState !== 'idle'
  }
}

async function refreshAuthStatus(): Promise<void> {
  const status = await window.careRecorder.getAuthStatus()
  hostEmail = status.email || ''
  authStatus.textContent = status.authenticated
    ? `Signed in as ${status.email || 'Google user'}`
    : 'Not connected'
  authButton.textContent = status.authenticated ? 'Reconnect' : 'Connect'
  chooseDriveFolderButton.disabled = !status.authenticated || uiState !== 'idle'

  if (status.authenticated) {
    await Promise.all([loadCalendarMeetings(), refreshDriveDestination()])
  } else {
    hostEmail = ''
    calendarMeetings = []
    renderCalendarMeetings()
    driveFolderSelected = false
    driveFolderLabel.textContent = 'Not selected'
    driveDestinationHint.textContent = 'Optional — uploads after each session.'
    chooseDriveFolderButton.textContent = 'Browse Google Drive…'
    clearDriveFolderButton.classList.add('hidden')
  }

  updateFoldSummaries()
  updateSettingsFoldState()
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

  let audioTracks: MediaStreamTrack[] = []
  if (captureMode === 'meet-tab') {
    // Meet tab frame audio carries all participants from the Meet WebRTC stream (not Windows loopback).
    if (displayAudio.length > 0 && micAudio.length > 0) {
      audioTracks = await mixAudioTracks(displayAudio, micAudio)
    } else if (displayAudio.length > 0) {
      audioTracks = displayAudio
    } else {
      audioTracks = micAudio
    }
  } else if (displayAudio.length > 0 && micAudio.length > 0) {
    audioTracks = await mixAudioTracks(displayAudio, micAudio)
  } else if (displayAudio.length > 0) {
    audioTracks = displayAudio
  } else if (micAudio.length > 0) {
    audioTracks = micAudio
  }

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
  const displayGain = audioContext.createGain()
  const micGain = audioContext.createGain()
  displayGain.gain.value = 1
  micGain.gain.value = 1

  displaySource.connect(displayGain)
  micGain.connect(destination)
  displayGain.connect(destination)
  micSource.connect(micGain)
  recordingAudioContext = audioContext
  return destination.stream.getAudioTracks()
}

function stopMediaRecorderOnly(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  mediaRecorder = null
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

  if (captureMode === 'meet-tab' && displayStream.getAudioTracks().length === 0) {
    console.warn('Meet tab audio track missing — only microphone will be recorded')
  }

  await createMediaRecorderForStream(stream)

  if (!(await waitForFirstChunk(3500))) {
    if (captureMode === 'meet-tab') {
      await retryMeetTabMicOnlyRecording()
      return recordingStream!
    }
    throw new Error(
      'Video capture did not start. Restart the app, allow the microphone, and keep the meeting visible on the right.'
    )
  }

  return stream
}

async function retryMeetTabMicOnlyRecording(): Promise<void> {
  stopMediaRecorderOnly()
  for (const track of recordingStream?.getTracks() || []) {
    track.stop()
  }
  recordingStream = null
  recordingBytesReceived = 0
  chunkWriteChain = Promise.resolve()

  await window.careRecorder.configureMeetTabCapture({ includeAudio: false })
  const displayStream = await acquireDisplayCapture(false)
  const stream = await buildRecordingStreamFromDisplay(displayStream)
  recordingStream = stream
  attachCaptureTrackGuards(stream)
  await createMediaRecorderForStream(stream)

  if (!(await waitForFirstChunk(3500))) {
    throw new Error(
      'Video capture did not start. Restart the app, allow the microphone, and keep the meeting visible on the right.'
    )
  }

  window.alert(
    'Could not capture meeting audio from the Meet tab. This recording will include your microphone only.\n\nFor group calls, try Browser window capture mode with your speakers on, or check that Meet volume is not muted.'
  )
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
  if (!status.open || !status.url.includes('meet.google.com')) {
    window.alert('Join your meeting here first (click "Join meeting here").')
    return false
  }
  return true
}

async function confirmRecordingNotice(): Promise<boolean> {
  if (!recordingNoticeCheckbox.checked) return true

  const notesOnly = getSessionMode() === 'notes-only'
  const action = notesOnly ? 'note-taking' : 'recording'
  return window.confirm(
    `Before ${action} starts:\n\n• Make sure everyone knows the meeting is being ${notesOnly ? 'noted' : 'recorded'}\n• Turn on Meet CC and enable speaker names in caption settings for names in the transcript\n\nContinue?`
  )
}

async function startSession(): Promise<void> {
  sessionMode = getSessionMode()
  updateSessionModeUi()

  if (!(await confirmRecordingNotice())) return

  const title =
    meetingTitleInput.value.trim() ||
    selectedCalendarMeeting?.title ||
    defaultMeetingTitle()
  meetingTitleInput.value = title
  startedAt = new Date().toISOString()
  chunkWriteChain = Promise.resolve()
  recordingBytesReceived = 0
  sessionEnding = false

  try {
    if (sessionMode === 'notes-only' || captureMode === 'meet-tab') {
      if (!(await ensureMeetReady())) {
        cleanupStreams()
        return
      }
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
    subscribeMeetCallEnded()
    startSessionTimer()
    if (sessionMode === 'notes-only' || captureMode === 'meet-tab') {
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
      calendarEventId: selectedCalendarMeeting?.id,
      hangoutLink: selectedCalendarMeeting?.hangoutLink,
      meetingCode: selectedCalendarMeeting?.meetingCode
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

function resetForNewSession(): void {
  completeMessage.textContent = ''
  sessionId = ''
  startedAt = ''
  sessionEnding = false
  unsubscribeMeetCallEnded()
  setUiState('idle')
  void loadCalendarMeetings()
}

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

sourceSelect.addEventListener('change', () => {
  updateSourcePreview(sources.find((source) => source.id === sourceSelect.value))
})

calendarMeetingSelect.addEventListener('change', () => {
  const meeting = calendarMeetings.find((item) => item.id === calendarMeetingSelect.value) || null
  applyCalendarMeeting(meeting)
})

openMeetButton.addEventListener('click', () => {
  void (async () => {
    openMeetButton.disabled = true
    meetStatus.textContent = 'Opening Meet...'
    await window.careRecorder.openMeet(getMeetUrl())
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
    }
    await refreshAuthStatus()
    authButton.disabled = uiState === 'recording' || uiState === 'processing'
  })()
})

refreshCalendarButton.addEventListener('click', () => {
  void loadCalendarMeetings()
})

openFolderButton.addEventListener('click', () => {
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

clearDriveFolderButton.addEventListener('click', () => {
  void (async () => {
    await window.careRecorder.clearDriveDestination()
    await refreshDriveDestination()
  })()
})

appUpdateAction.addEventListener('click', () => {
  void window.careRecorder.installAppUpdate()
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
  updateSettingsFoldState()
  const micStatus = await window.careRecorder.getMicrophonePermissionStatus()
  if (micStatus.status === 'denied') {
    updateReadyStatus('Microphone declined — reset permissions to record your voice')
  }
  setUiState('idle')
}

void bootstrap()
