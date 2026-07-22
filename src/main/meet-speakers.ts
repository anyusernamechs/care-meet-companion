import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getMeetView } from './meet-view'
import { log } from './logger'
import { getHostDisplayName } from './services/google-auth'
import { runInMeet } from './meet-captions'

export interface MeetSpeakerSegment {
  speaker: string
  startedAt: string
  endedAt: string
}

interface SpeakerStore {
  sessionId: string
  hostDisplayName?: string
  startedAt?: string
  roster: string[]
  segments: MeetSpeakerSegment[]
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let activeSessionId = ''
let speakerFilePath = ''
let sessionHostDisplayName = ''
let sessionStartedAt = ''

function getSpeakerFilePath(sessionDir: string): string {
  return join(sessionDir, 'meet-speakers.json')
}

function readStore(): SpeakerStore {
  if (!speakerFilePath || !existsSync(speakerFilePath)) {
    return {
      sessionId: activeSessionId,
      hostDisplayName: sessionHostDisplayName,
      startedAt: sessionStartedAt,
      roster: [],
      segments: []
    }
  }
  try {
    return JSON.parse(readFileSync(speakerFilePath, 'utf8')) as SpeakerStore
  } catch {
    return {
      sessionId: activeSessionId,
      hostDisplayName: sessionHostDisplayName,
      startedAt: sessionStartedAt,
      roster: [],
      segments: []
    }
  }
}

function writeStore(store: SpeakerStore): void {
  if (!speakerFilePath) return
  writeFileSync(speakerFilePath, JSON.stringify(store, null, 2), 'utf8')
}

function resolveSpeakerName(speaker: string, hostDisplayName?: string): string {
  const trimmed = speaker.trim()
  if (!/^you$/i.test(trimmed)) return trimmed
  return hostDisplayName?.trim() || trimmed
}

function appendSegments(segments: MeetSpeakerSegment[]): void {
  if (!segments.length) return
  const store = readStore()
  const host = store.hostDisplayName || sessionHostDisplayName
  for (const segment of segments) {
    const speaker = resolveSpeakerName(segment.speaker, host)
    if (!speaker) continue
    store.segments.push({
      speaker,
      startedAt: segment.startedAt,
      endedAt: segment.endedAt
    })
    if (!store.roster.includes(speaker)) store.roster.push(speaker)
  }
  writeStore(store)
}

function mergeRoster(names: string[]): void {
  if (!names.length) return
  const store = readStore()
  const host = store.hostDisplayName || sessionHostDisplayName
  for (const raw of names) {
    const name = resolveSpeakerName(raw, host)
    if (!name || store.roster.includes(name)) continue
    store.roster.push(name)
  }
  writeStore(store)
}

export async function startMeetSpeakerCapture(
  sessionId: string,
  sessionDir: string,
  startedAt: string
): Promise<void> {
  try {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }

    if (!existsSync(sessionDir)) {
      mkdirSync(sessionDir, { recursive: true })
    }

    activeSessionId = sessionId
    speakerFilePath = getSpeakerFilePath(sessionDir)
    sessionHostDisplayName = getHostDisplayName() || ''
    sessionStartedAt = startedAt
    writeStore({
      sessionId,
      hostDisplayName: sessionHostDisplayName,
      startedAt,
      roster: [],
      segments: []
    })

    const view = getMeetView()
    if (!view || view.webContents.isDestroyed()) return

    await runInMeet('true', view.webContents)
    await runInMeet('window.__careMeetCaptions?.startSpeakerMonitor?.(); true', view.webContents)

    pollTimer = setInterval(() => {
      void pollMeetSpeakers()
    }, 500)
  } catch (error) {
    log.error('meet-speakers', 'Failed to start Meet speaker capture', error)
  }
}

async function pollMeetSpeakers(): Promise<void> {
  const result = await runInMeet<{
    roster?: string[]
    segments?: MeetSpeakerSegment[]
    activeSpeaker?: string
  }>(
    `(() => {
      return window.__careMeetCaptions?.tickSpeakers?.() || { roster: [], segments: [], activeSpeaker: '' };
    })()`
  )

  if (result?.roster?.length) mergeRoster(result.roster)
  if (result?.segments?.length) appendSegments(result.segments)
}

export async function stopMeetSpeakerCapture(): Promise<MeetSpeakerSegment[]> {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  const flushResult = await runInMeet<{
    roster?: string[]
    segments?: MeetSpeakerSegment[]
    flushed?: MeetSpeakerSegment[]
  }>('window.__careMeetCaptions?.stopSpeakerMonitor?.() || { roster: [], segments: [], flushed: [] }')

  if (flushResult?.roster?.length) mergeRoster(flushResult.roster)
  const leftover = [...(flushResult?.flushed || []), ...(flushResult?.segments || [])]
  if (leftover.length) appendSegments(leftover)

  const store = readStore()
  activeSessionId = ''
  return store.segments
}

export function loadMeetSpeakers(sessionDir: string): SpeakerStore {
  const path = getSpeakerFilePath(sessionDir)
  if (!existsSync(path)) {
    return { sessionId: '', roster: [], segments: [] }
  }
  try {
    const store = JSON.parse(readFileSync(path, 'utf8')) as SpeakerStore
    const host = store.hostDisplayName || getHostDisplayName() || ''
    return {
      ...store,
      roster: (store.roster || []).map((name) => resolveSpeakerName(name, host)),
      segments: (store.segments || []).map((segment) => ({
        ...segment,
        speaker: resolveSpeakerName(segment.speaker, host)
      }))
    }
  } catch {
    return { sessionId: '', roster: [], segments: [] }
  }
}

export function speakerAtOffset(
  segments: MeetSpeakerSegment[],
  recordingStartedAt: string,
  offsetMs: number
): string {
  if (!segments.length || !recordingStartedAt) return ''
  const origin = new Date(recordingStartedAt).getTime()
  if (!Number.isFinite(origin)) return ''
  const target = origin + Math.max(0, offsetMs)

  let best = ''
  let bestOverlap = 0
  for (const segment of segments) {
    const start = new Date(segment.startedAt).getTime()
    const end = new Date(segment.endedAt || segment.startedAt).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    const overlapStart = Math.max(start, target - 750)
    const overlapEnd = Math.min(end, target + 750)
    const overlap = overlapEnd - overlapStart
    if (overlap > bestOverlap) {
      bestOverlap = overlap
      best = segment.speaker
    }
    if (target >= start && target <= end) {
      return segment.speaker
    }
  }
  return best
}

export function labelTranscriptWithSpeakers(
  srtText: string,
  plainText: string,
  store: SpeakerStore,
  recordingStartedAt: string
): string {
  const cues = parseSrt(srtText)
  if (!cues.length || !store.segments.length) {
    return plainText
  }

  const labeled: string[] = []
  let lastSpeaker = ''
  for (const cue of cues) {
    const mid = Math.floor((cue.startMs + cue.endMs) / 2)
    const speaker = speakerAtOffset(store.segments, recordingStartedAt || store.startedAt || '', mid)
    const name = speaker || 'Participant'
    if (name !== lastSpeaker) {
      if (labeled.length) labeled.push('')
      labeled.push(`${name}:`)
      lastSpeaker = name
    }
    labeled.push(cue.text)
  }

  return labeled.join('\n')
}

interface SrtCue {
  startMs: number
  endMs: number
  text: string
}

function parseSrt(content: string): SrtCue[] {
  const blocks = content.replace(/\r\n/g, '\n').split(/\n\s*\n/)
  const cues: SrtCue[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length < 2) continue
    const timeLine = lines.find((line) => line.includes('-->'))
    if (!timeLine) continue
    const match = timeLine.match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    )
    if (!match) continue
    const startMs =
      (Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])) * 1000 + Number(match[4])
    const endMs =
      (Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7])) * 1000 + Number(match[8])
    const text = lines
      .slice(lines.indexOf(timeLine) + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim()
    if (!text) continue
    cues.push({ startMs, endMs, text })
  }
  return cues
}
