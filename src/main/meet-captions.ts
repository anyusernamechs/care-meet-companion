import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { WebContents } from 'electron'
import { getMeetView } from './meet-view'
import { log } from './logger'
import { getHostDisplayName } from './services/google-auth'
import { reportMeetCallState } from './meet-session-monitor'

export interface MeetCaptionLine {
  speaker: string
  text: string
  at: string
}

interface CaptionStore {
  sessionId: string
  hostDisplayName?: string
  lines: MeetCaptionLine[]
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let activeSessionId = ''
let captionFilePath = ''
let injectScript = ''
let injectScriptMissingLogged = false
let sessionHostDisplayName = ''

function resolveInjectScriptPath(): string {
  const bundled = join(__dirname, 'meet-caption-inject.js')
  const devSource = join(process.cwd(), 'src', 'main', 'meet-caption-inject.js')

  if (!app.isPackaged && existsSync(devSource)) {
    return devSource
  }
  if (existsSync(bundled)) {
    return bundled
  }
  if (existsSync(devSource)) {
    return devSource
  }

  throw new Error(
    'meet-caption-inject.js is missing. Restart with npm run dev, or run npm run build.'
  )
}

function loadInjectScript(): string {
  if (!injectScript) {
    injectScript = readFileSync(resolveInjectScriptPath(), 'utf8')
  }
  return injectScript
}

function reloadInjectScript(): string {
  injectScript = readFileSync(resolveInjectScriptPath(), 'utf8')
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

function resolveCaptionSpeaker(speaker: string, hostDisplayName?: string): string {
  const trimmed = speaker.trim()
  if (!/^you$/i.test(trimmed)) return trimmed
  return hostDisplayName?.trim() || trimmed
}

function normalizeCaptionLine(line: MeetCaptionLine, hostDisplayName?: string): MeetCaptionLine {
  return {
    ...line,
    speaker: resolveCaptionSpeaker(line.speaker, hostDisplayName)
  }
}

function isCaptionRevision(older: string, newer: string): boolean {
  const a = older.trim().toLowerCase()
  const b = newer.trim().toLowerCase()
  if (!a || !b) return false
  if (a === b) return true
  if (b.startsWith(a)) {
    const next = b[a.length]
    if (!next || /[\s.,!?;:]/.test(next)) return true
  }
  if (a.startsWith(b)) {
    const next = a[b.length]
    if (!next || /[\s.,!?;:]/.test(next)) return true
  }
  return false
}

function isMeetChromeCaption(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  return (
    /returning to home screen/i.test(t) ||
    /\d+\s*seconds?\s*left/i.test(t) ||
    /left in \d+/i.test(t) ||
    /you left the meeting/i.test(t) ||
    /rejoin the meeting/i.test(t) ||
    /thanks for joining/i.test(t) ||
    /meeting has ended/i.test(t) ||
    /return to home screen/i.test(t)
  )
}

function stripSpeakerPrefix(speaker: string, text: string): string {
  const s = speaker.trim()
  let t = text.trim()
  if (!t) return ''
  if (!s || /^participant$/i.test(s)) return t
  if (t.toLowerCase().startsWith(s.toLowerCase())) {
    t = t.slice(s.length).trim()
  }
  return t
}

function cleanCaptionLine(line: MeetCaptionLine): MeetCaptionLine | null {
  const text = stripSpeakerPrefix(line.speaker, line.text)
  if (!text || isMeetChromeCaption(text)) return null
  return { ...line, text }
}

export function filterCaptionsForTranscript(lines: MeetCaptionLine[]): MeetCaptionLine[] {
  return dedupeProgressiveCaptions(lines)
    .map((line) => cleanCaptionLine(line))
    .filter((line): line is MeetCaptionLine => line !== null)
}

export function dedupeProgressiveCaptions(lines: MeetCaptionLine[]): MeetCaptionLine[] {
  const out: MeetCaptionLine[] = []

  for (const line of lines) {
    const prev = out[out.length - 1]
    if (prev && prev.speaker === line.speaker && isCaptionRevision(prev.text, line.text)) {
      if (line.text.trim().length >= prev.text.trim().length) {
        out[out.length - 1] = line
      }
      continue
    }
    out.push(line)
  }

  return out
}

function mergeIntoStore(store: CaptionStore, incoming: MeetCaptionLine[]): void {
  for (const line of incoming) {
    const prev = store.lines[store.lines.length - 1]
    if (prev && prev.speaker === line.speaker && isCaptionRevision(prev.text, line.text)) {
      if (line.text.trim().length >= prev.text.trim().length) {
        store.lines[store.lines.length - 1] = line
      }
      continue
    }
    store.lines.push(line)
  }
}

function appendLines(lines: MeetCaptionLine[]): void {
  if (!lines.length) return
  const store = readStore()
  const hostName = store.hostDisplayName || sessionHostDisplayName
  mergeIntoStore(
    store,
    lines.map((line) => normalizeCaptionLine(line, hostName))
  )
  writeStore(store)
}

async function runInMeet<T>(runner: string, webContents?: WebContents): Promise<T | null> {
  const view = getMeetView()
  const target = webContents || view?.webContents
  if (!target || target.isDestroyed()) return null

  try {
    const script = app.isPackaged ? loadInjectScript() : reloadInjectScript()
    await target.executeJavaScript(script, true)
    return await target.executeJavaScript(runner, true)
  } catch (error) {
    if (!injectScriptMissingLogged) {
      injectScriptMissingLogged = true
      log.warn('meet-captions', 'Meet script failed', error)
    }
    return null
  }
}

export async function getMeetCaptionStatus(): Promise<{
  on: boolean
  regionFound: boolean
  visibleRows: number
  linesCaptured: number
  hasSpeakerNames: boolean
}> {
  const view = getMeetView()
  if (!view || view.webContents.isDestroyed()) {
    return { on: false, regionFound: false, visibleRows: 0, linesCaptured: 0, hasSpeakerNames: false }
  }

  const status = await runInMeet<{ on: boolean; regionFound?: boolean; visibleRows?: number }>(
    'window.__careMeetCaptions?.captionStatus?.() || { on: false, regionFound: false, visibleRows: 0 }',
    view.webContents
  )

  const store = readStore()
  const lines = store.lines || []

  return {
    on: Boolean(status?.on),
    regionFound: Boolean(status?.regionFound),
    visibleRows: status?.visibleRows ?? 0,
    linesCaptured: lines.length,
    hasSpeakerNames: captionsIncludeSpeakerNames(lines)
  }
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
    sessionHostDisplayName = getHostDisplayName() || ''
    writeStore({ sessionId, hostDisplayName: sessionHostDisplayName, lines: [] })

    const view = getMeetView()
    if (!view || view.webContents.isDestroyed()) return

    await runInMeet('true', view.webContents)
    await runInMeet('window.__careMeetCaptions?.tryEnableCaptions?.(); true', view.webContents)
    await runInMeet('window.__careMeetCaptions?.startCapture?.(); true', view.webContents)
    await runInMeet('window.__careMeetCaptions?.tryEnableSpeakerNames?.(); true', view.webContents)

    pollTimer = setInterval(() => {
      void pollMeetCaptions()
    }, 500)
  } catch (error) {
    log.error('meet-captions', 'Failed to start Meet caption capture', error)
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
  return filterCaptionsForTranscript(store.lines)
}

export function loadMeetCaptions(sessionDir: string): MeetCaptionLine[] {
  const path = join(sessionDir, 'meet-captions.json')
  if (!existsSync(path)) return []
  try {
    const store = JSON.parse(readFileSync(path, 'utf8')) as CaptionStore
    const hostName = store.hostDisplayName || getHostDisplayName()
    const normalized = (store.lines || []).map((line) => normalizeCaptionLine(line, hostName))
    return filterCaptionsForTranscript(normalized)
  } catch {
    return []
  }
}

export function formatMeetCaptionTranscript(lines: MeetCaptionLine[]): string {
  const cleaned = filterCaptionsForTranscript(lines)
  if (!cleaned.length) return ''

  const body = cleaned
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
  const cleaned = filterCaptionsForTranscript(lines)
  const textLength = cleaned.reduce((sum, line) => sum + line.text.trim().length, 0)
  return cleaned.length >= 1 && textLength >= 12
}

export function captionsIncludeSpeakerNames(lines: MeetCaptionLine[]): boolean {
  const named = lines.filter((line) => {
    const speaker = line.speaker?.trim() || ''
    return speaker.length > 0 && speaker !== 'Participant' && !/^you$/i.test(speaker)
  })
  return named.length >= 1
}
