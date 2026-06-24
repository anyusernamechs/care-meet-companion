export type CaptureMode = 'meet-tab' | 'window' | 'screen'

export type SessionMode = 'record' | 'notes-only'

export type MeetCallEndedReason = 'left-meeting' | 'navigated-away'

export type RecordingStatus =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'uploading'
  | 'complete'
  | 'error'

export interface CaptureSource {
  id: string
  name: string
  thumbnail: string
  appIcon?: string
  displayId?: string
}

/** User's own Google Calendar event with a Meet link (not a delegated meetroom). */
export interface CalendarMeeting {
  id: string
  title: string
  startTime: string
  endTime: string
  hangoutLink?: string
  meetingCode?: string
  organizerEmail?: string
  organizerName?: string
  isActive: boolean
  isUpcoming: boolean
}

export interface RecordingSession {
  id: string
  title: string
  startedAt: string
  status: RecordingStatus
  hostEmail?: string
  calendarEventId?: string
  hangoutLink?: string
  meetingCode?: string
  localWebmPath?: string
  localMp4Path?: string
  localTranscriptPath?: string
  driveVideoFileId?: string
  driveTranscriptFileId?: string
  error?: string
}

export interface DriveDestination {
  folderId: string
  folderName: string
  driveId?: string
  pathLabel: string
}

export interface DriveRootEntry {
  id: string
  name: string
  driveId?: string
}

export interface DriveFolderEntry {
  id: string
  name: string
}

export interface AppConfig {
  recordingsDir: string
  synologyPath?: string
  ffmpegPath: string
  whisperPath: string
  whisperModelPath?: string
  whisperEnabled: boolean
  bundledToolsReady: boolean
  googleClientId: string
  googleClientSecret: string
  googleRedirectUri: string
  driveFolderId: string
  driveFolderLabel: string
  driveId?: string
  googleChatWebhookUrl?: string
  firebaseApiKey: string
  firebaseProjectId: string
  firebaseAppId: string
  notifyEmail: string
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
}

export interface ProcessingResult {
  session: RecordingSession
  message: string
}

export interface BeginRecordingSessionResult {
  folderName: string
  folderPath: string
}

export interface StartProcessingPayload {
  sessionId: string
  title: string
  startedAt: string
  mode?: SessionMode
  hostEmail?: string
  calendarEventId?: string
  hangoutLink?: string
  meetingCode?: string
}

export interface MeetCallEndedEvent {
  reason: MeetCallEndedReason
}

export interface MeetStatus {
  open: boolean
  url: string
  title: string
  ready?: boolean
}

export interface CareRecorderAPI {
  getConfig: () => Promise<
    Pick<AppConfig, 'recordingsDir' | 'whisperEnabled' | 'driveFolderId' | 'driveFolderLabel'> & {
      transcriptionReady: boolean
    }
  >
  getCaptureSources: () => Promise<CaptureSource[]>
  setCaptureMode: (mode: CaptureMode) => Promise<void>
  setCaptureSource: (sourceId: string) => Promise<void>
  configureMeetTabCapture: (options: { includeAudio?: boolean }) => Promise<void>
  openMeet: (url: string) => Promise<MeetStatus>
  openMeetInBrowser: (url: string) => Promise<void>
  getMeetStatus: () => Promise<MeetStatus>
  getMeetCaptionStatus: () => Promise<{ on: boolean }>
  getSidebarExpanded: () => Promise<boolean>
  setSidebarExpanded: (expanded: boolean) => Promise<boolean>
  toggleSidebar: () => Promise<boolean>
  prepareCapture: () => Promise<{ ready: boolean; message?: string }>
  ensureMicrophoneAccess: () => Promise<{ granted: boolean; message?: string }>
  openMicrophoneSettings: () => Promise<void>
  resetMicrophonePermissions: () => Promise<void>
  startGoogleAuth: () => Promise<{ success: boolean; email?: string; error?: string }>
  getAuthStatus: () => Promise<{ authenticated: boolean; email?: string }>
  getDriveDestination: () => Promise<DriveDestination | null>
  setDriveDestination: (destination: DriveDestination) => Promise<DriveDestination>
  clearDriveDestination: () => Promise<void>
  listDriveRoots: () => Promise<DriveRootEntry[]>
  listDriveFolders: (parentId: string, driveId?: string) => Promise<DriveFolderEntry[]>
  getCalendarMeetings: () => Promise<CalendarMeeting[]>
  getCurrentMeeting: () => Promise<CalendarMeeting | null>
  beginRecordingSession: (payload: {
    title: string
    startedAt: string
    mode?: SessionMode
  }) => Promise<BeginRecordingSessionResult>
  setRecordingActive: (active: boolean) => Promise<void>
  saveRecordingChunk: (sessionId: string, chunk: ArrayBuffer, isFinal: boolean) => Promise<void>
  startProcessing: (payload: StartProcessingPayload) => Promise<ProcessingResult>
  onProcessingProgress: (callback: (message: string) => void) => () => void
  onMeetCallEnded: (callback: (event: MeetCallEndedEvent) => void) => () => void
  onSidebarChanged: (callback: (expanded: boolean) => void) => () => void
}

declare global {
  interface Window {
    careRecorder: CareRecorderAPI
  }
}

export {}
