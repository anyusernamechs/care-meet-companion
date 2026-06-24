import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { WebContents } from 'electron'
import { getMeetView } from './meet-view'
import { reportMeetCallState } from './meet-session-monitor'

export interface MeetCaptionLine {
  speaker: string
  text: string
  at: string
}

interface CaptionStore {
  sessionId: string
  lines: MeetCaptionLine[]
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let activeSessionId = ''
let captionFilePath = ''
let injectScript = ''

function loadInjectScript(): string {
  if (!injectScript) {
    injectScript = readFileSync(join(__dirname, 'meet-caption-inject.js'), 'utf8')
  }
  return injectScript
}

function getCaptionFilePath(sessionId: string, sessionDir: string): string {
  return join(sessionDir, 'meet-captions.json')
}

function readStore(): CaptionStore {
  if (!captionFilePath || !existsSync(captionFilePath)) {
    return { sessionId: activeSessionId, lines: [] }
  }
  try {
    return JSON.parse(readFileSync(captionFilePath, 'utf8')) as CaptionStore
  } catch {
    return { sessionId: activeSessionId, lines: [] }
  }
}

function writeStore(store: CaptionStore): void {
  if (!captionFilePath) return
  writeFileSync(captionFilePath, JSON.stringify(store, null, 2), 'utf8')
}

function appendLines(lines: MeetCaptionLine[]): void {
  if (!lines.length) return
  const store = readStore()
  store.lines.push(...lines)
  writeStore(store)
}

async function runInMeet<T>(runner: string, webContents?: WebContents): Promise<T | null> {
  const view = getMeetView()
  const target = webContents || view?.webContents
  if (!target || target.isDestroyed()) return null

  try {
    await target.executeJavaScript(loadInjectScript(), true)
    return await target.executeJavaScript(runner, true)
  } catch {
    return null
  }
}

export async function getMeetCaptionStatus(): Promise<{ on: boolean }> {
  const view = getMeetView()
  if (!view || view.webContents.isDestroyed()) {
    return { on: false }
  }

  const status = await runInMeet<{ on: boolean }>(
    'window.__careMeetCaptions?.captionStatus?.() || { on: false }',
    view.webContents
  )

  return { on: Boolean(status?.on) }
}

export async function startMeetCaptionCapture(sessionId: string, sessionDir: string): Promise<void> {
  try {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true })
    }

    activeSessionId = sessionId
    captionFilePath = getCaptionFilePath(sessionId, sessionDir)
    writeStore({ sessionId, lines: [] })

    const view = getMeetView()
    if (!view || view.webContents.isDestroyed()) return

    await runInMeet('true', view.webContents)
    await runInMeet('window.__careMeetCaptions?.startCapture?.(); true', view.webContents)
    await runInMeet('window.__careMeetCaptions?.tryEnableSpeakerNames?.(); true', view.webContents)

    pollTimer = setInterval(() => {
      void pollMeetCaptions()
    }, 750)
  } catch (error) {
    console.error('Failed to start Meet caption capture:', error)
  }
}

async function pollMeetCaptions(): Promise<void> {
  const result = await runInMeet<{
    enabled: boolean
    finalized: MeetCaptionLine[]
    callState?: 'in-call' | 'left' | 'unknown'
  }>(
    `(() => {
      const tick = window.__careMeetCaptions?.tick?.() || { enabled: false, finalized: [] };
      const callState = window.__careMeetCaptions?.getCallState?.() || 'unknown';
      return { ...tick, callState };
    })()`
  )

  if (result?.callState) {
    reportMeetCallState(result.callState)
  }

  if (result?.finalized?.length) {
    appendLines(result.finalized)
  }
}

export async function stopMeetCaptionCapture(): Promise<MeetCaptionLine[]> {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  const flushResult = await runInMeet<{ finalized: MeetCaptionLine[] }>(
    'window.__careMeetCaptions?.stopCapture?.() || window.__careMeetCaptions?.flush?.() || { finalized: [] }'
  )
  if (flushResult?.finalized?.length) {
    appendLines(flushResult.finalized)
  }

  const store = readStore()
  activeSessionId = ''
  return store.lines
}

export function loadMeetCaptions(sessionDir: string): MeetCaptionLine[] {
  const path = join(sessionDir, 'meet-captions.json')
  if (!existsSync(path)) return []
  try {
    const store = JSON.parse(readFileSync(path, 'utf8')) as CaptionStore
    return store.lines || []
  } catch {
    return []
  }
}

export function formatMeetCaptionTranscript(lines: MeetCaptionLine[]): string {
  if (!lines.length) return ''

  const body = lines
    .map((line) => {
      const time = new Date(line.at).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
      })
      return `[${time}] ${line.speaker}: ${line.text}`
    })
    .join('\n\n')

  return [
    'Transcript from Google Meet captions (participant names).',
    'For best results, keep Meet captions (CC) on during the meeting.',
    '',
    body
  ].join('\n')
}

export function hasUsableMeetCaptions(lines: MeetCaptionLine[]): boolean {
  const textLength = lines.reduce((sum, line) => sum + line.text.trim().length, 0)
  return lines.length >= 1 && textLength >= 12
}

export function captionsIncludeSpeakerNames(lines: MeetCaptionLine[]): boolean {
  const named = lines.filter((line) => {
    const speaker = line.speaker?.trim() || ''
    return speaker.length > 0 && speaker !== 'Participant'
  })
  return named.length >= 1
}
