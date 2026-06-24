import { contextBridge, ipcRenderer } from 'electron'
import type { CareRecorderAPI, MeetCallEndedEvent } from '../shared/types'

const api: CareRecorderAPI = {
  getConfig: () => ipcRenderer.invoke('care:get-config'),
  getCaptureSources: () => ipcRenderer.invoke('care:get-capture-sources'),
  setCaptureMode: (mode) => ipcRenderer.invoke('care:set-capture-mode', mode),
  setCaptureSource: (sourceId) => ipcRenderer.invoke('care:set-capture-source', sourceId),
  configureMeetTabCapture: (options) =>
    ipcRenderer.invoke('care:configure-meet-tab-capture', options),
  openMeet: (url) => ipcRenderer.invoke('care:open-meet', url),
  openMeetInBrowser: (url) => ipcRenderer.invoke('care:open-meet-browser', url),
  getMeetStatus: () => ipcRenderer.invoke('care:get-meet-status'),
  getMeetCaptionStatus: () => ipcRenderer.invoke('care:get-meet-caption-status'),
  getSidebarExpanded: () => ipcRenderer.invoke('care:get-sidebar-expanded'),
  setSidebarExpanded: (expanded) => ipcRenderer.invoke('care:set-sidebar-expanded', expanded),
  toggleSidebar: () => ipcRenderer.invoke('care:toggle-sidebar'),
  prepareCapture: () => ipcRenderer.invoke('care:prepare-capture'),
  ensureMicrophoneAccess: () => ipcRenderer.invoke('care:ensure-microphone-access'),
  openMicrophoneSettings: () => ipcRenderer.invoke('care:open-microphone-settings'),
  resetMicrophonePermissions: () => ipcRenderer.invoke('care:reset-microphone-permissions'),
  startGoogleAuth: () => ipcRenderer.invoke('care:start-google-auth'),
  getAuthStatus: () => ipcRenderer.invoke('care:get-auth-status'),
  getDriveDestination: () => ipcRenderer.invoke('care:get-drive-destination'),
  setDriveDestination: (destination) => ipcRenderer.invoke('care:set-drive-destination', destination),
  clearDriveDestination: () => ipcRenderer.invoke('care:clear-drive-destination'),
  listDriveRoots: () => ipcRenderer.invoke('care:list-drive-roots'),
  listDriveFolders: (parentId, driveId) =>
    ipcRenderer.invoke('care:list-drive-folders', parentId, driveId),
  getCalendarMeetings: () => ipcRenderer.invoke('care:get-calendar-meetings'),
  getCurrentMeeting: () => ipcRenderer.invoke('care:get-current-meeting'),
  beginRecordingSession: (payload) => ipcRenderer.invoke('care:begin-recording-session', payload),
  setRecordingActive: (active) => ipcRenderer.invoke('care:set-recording-active', active),
  saveRecordingChunk: (sessionId, chunk, isFinal) =>
    ipcRenderer.invoke('care:save-recording-chunk', sessionId, chunk, isFinal),
  startProcessing: (payload) => ipcRenderer.invoke('care:start-processing', payload),
  onProcessingProgress: (callback) => {
    ipcRenderer.send('care:subscribe-progress')
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('care:processing-progress', listener)
    return () => {
      ipcRenderer.removeListener('care:processing-progress', listener)
    }
  },
  onMeetCallEnded: (callback) => {
    ipcRenderer.send('care:subscribe-meet-events')
    const listener = (_event: Electron.IpcRendererEvent, payload: MeetCallEndedEvent) =>
      callback(payload)
    ipcRenderer.on('care:meet-call-ended', listener)
    return () => {
      ipcRenderer.removeListener('care:meet-call-ended', listener)
    }
  },
  onSidebarChanged: (callback) => {
    ipcRenderer.send('care:subscribe-sidebar')
    const listener = (_event: Electron.IpcRendererEvent, payload: { expanded: boolean }) =>
      callback(payload.expanded)
    ipcRenderer.on('care:sidebar-changed', listener)
    return () => {
      ipcRenderer.removeListener('care:sidebar-changed', listener)
    }
  }
}

contextBridge.exposeInMainWorld('careRecorder', api)
contextBridge.exposeInMainWorld('careRecorderExtras', {
  openRecordingsFolder: () => ipcRenderer.send('care:open-recordings-folder')
})

declare global {
  interface Window {
    careRecorderExtras: {
      openRecordingsFolder: () => void
    }
  }
}

export {}
