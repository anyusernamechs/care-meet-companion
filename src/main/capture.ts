import { desktopCapturer, session, type BrowserWindow, type Streams } from 'electron'
import type { CaptureMode } from '../shared/types'
import { getMeetView, GOOGLE_SESSION_PARTITION, prepareMeetForRecording } from './meet-view'

let captureMode: CaptureMode = 'meet-tab'
let selectedSourceId = ''
let meetTabIncludeAudio = true

export function setCaptureMode(mode: CaptureMode): void {
  captureMode = mode
}

export function getCaptureMode(): CaptureMode {
  return captureMode
}

export function setSelectedCaptureSource(sourceId: string): void {
  selectedSourceId = sourceId
}

export function configureMeetTabCapture(options: { includeAudio?: boolean }): void {
  if (options.includeAudio !== undefined) {
    meetTabIncludeAudio = options.includeAudio
  }
}

function meetTabStreams(includeAudio: boolean): Streams | null {
  const meetView = getMeetView()
  if (!meetView || meetView.webContents.isDestroyed()) {
    return null
  }

  const frame = meetView.webContents.mainFrame
  if (!frame) {
    return null
  }

  meetView.webContents.setAudioMuted(false)

  if (includeAudio && meetTabIncludeAudio) {
    const audio = frame
    return {
      video: frame,
      audio,
      enableLocalEcho: true
    }
  }

  return { video: frame }
}

function installHandler(targetSession: Electron.Session): void {
  targetSession.setDisplayMediaRequestHandler((_request, callback) => {
    if (captureMode === 'meet-tab') {
      const streams = meetTabStreams(meetTabIncludeAudio)
      callback(streams || {})
      return
    }

    if (captureMode === 'screen') {
      void desktopCapturer
        .getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          const selected = sources.find((source) => source.id === selectedSourceId) || sources[0]
          callback(selected ? { video: selected, audio: 'loopback' } : {})
        })
        .catch(() => callback({}))
      return
    }

    void desktopCapturer
      .getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        let selected = sources.find((source) => source.id === selectedSourceId)
        if (!selected) {
          selected = sources.find((source) => /meet\.google\.com|Google Meet/i.test(source.name))
        }
        selected = selected || sources[0]
        callback(selected ? { video: selected, audio: 'loopback' } : {})
      })
      .catch(() => callback({}))
  })
}

export function registerDisplayMediaHandler(): void {
  installHandler(session.defaultSession)
  installHandler(session.fromPartition(GOOGLE_SESSION_PARTITION))
}

export function prepareCapture(mainWindow: BrowserWindow): { ready: boolean; message?: string } {
  if (captureMode !== 'meet-tab') {
    return { ready: true }
  }

  const meetView = getMeetView()
  if (!meetView) {
    return { ready: false, message: 'Open your meeting in the app first.' }
  }

  if (meetView.webContents.isLoading()) {
    return { ready: false, message: 'Meet is still loading. Wait a moment and try again.' }
  }

  prepareMeetForRecording(mainWindow)
  return { ready: true }
}
