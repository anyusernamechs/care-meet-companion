import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync, type WriteStream } from 'fs'
import { join } from 'path'
import { getSessionDir, loadConfig } from '../config'
import { assertRegisteredSession, unregisterSession } from '../session-registry'
import { getRecordingsRoot, sanitizeFileName } from '../paths'
import {
  convertWebmToMp4,
  extractAudioWav,
  probeMediaFile,
  sessionPaths
} from './ffmpeg'
import { generateTranscript } from './whisper'
import { fetchMeetArtifacts } from './meet-artifacts'
import {
  captionsIncludeSpeakerNames,
  formatMeetCaptionTranscript,
  hasUsableMeetCaptions,
  loadMeetCaptions,
  stopMeetCaptionCapture
} from '../meet-captions'
import { ensureDriveSessionFolder, uploadFileToDrive } from './drive'
import { saveRecordingMetadata } from './firestore'
import type { ProcessingResult, RecordingSession, StartProcessingPayload } from '../../shared/types'

interface OpenSession {
  stream: WriteStream
  writes: Promise<void>
}

const openSessions = new Map<string, OpenSession>()
const finalizedSessions = new Set<string>()

const TEMP_WEBM = '.temp-recording.webm'

export function beginSession(folderName: string, config = loadConfig()): string {
  const sessionDir = getSessionDir(config, folderName)
  const webmPath = join(sessionDir, TEMP_WEBM)

  finalizedSessions.delete(folderName)

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true })
  }

  openSessions.set(folderName, {
    stream: createWriteStream(webmPath, { flags: 'w' }),
    writes: Promise.resolve()
  })

  return sessionDir
}

export function beginNotesSession(folderName: string, config = loadConfig()): string {
  const sessionDir = getSessionDir(config, folderName)
  finalizedSessions.delete(folderName)

  if (!existsSync(sessionDir)) {
    mkdirSync(sessionDir, { recursive: true })
  }

  return sessionDir
}

function ensureOpenSession(folderName: string, chunk: Buffer, isFinal: boolean): OpenSession | null {
  if (finalizedSessions.has(folderName)) {
    return null
  }

  let session = openSessions.get(folderName)
  if (!session) {
    return null
  }

  return session
}

export async function appendChunk(
  folderName: string,
  chunk: Buffer,
  isFinal: boolean
): Promise<void> {
  assertRegisteredSession(folderName)
  const session = ensureOpenSession(folderName, chunk, isFinal)
  if (!session) {
    return
  }

  const activeSession = session
  activeSession.writes = activeSession.writes.then(async () => {
    if (finalizedSessions.has(folderName)) {
      return
    }

    if (chunk.length > 0) {
      await new Promise<void>((resolve, reject) => {
        activeSession.stream.write(chunk, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }

    if (isFinal) {
      await new Promise<void>((resolve, reject) => {
        activeSession.stream.end((error: Error | null | undefined) => {
          if (error) reject(error)
          else resolve()
        })
      })
      openSessions.delete(folderName)
      finalizedSessions.add(folderName)
    }
  })

  await activeSession.writes
}

export async function finalizeSession(folderName: string): Promise<void> {
  const session = openSessions.get(folderName)
  if (!session) return

  await session.writes

  if (openSessions.has(folderName)) {
    await new Promise<void>((resolve, reject) => {
      session.stream.end((error: Error | null | undefined) => {
        if (error) reject(error)
        else resolve()
      })
    })
    openSessions.delete(folderName)
  }
}

function validateRecordingFile(webmPath: string): void {
  if (!existsSync(webmPath)) {
    throw new Error(`Recording file not found: ${webmPath}`)
  }

  const size = statSync(webmPath).size
  if (size < 1024) {
    throw new Error(
      `Recording file is empty or invalid (${size} bytes). Keep the Meet tab open while recording, record for at least a few seconds, and avoid minimizing the window, then stop again.`
    )
  }
}

function cleanupTempMedia(paths: { webm: string; wav: string }): void {
  for (const file of [paths.webm, paths.wav]) {
    if (!file || !existsSync(file)) continue
    try {
      unlinkSync(file)
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function processRecording(
  payload: StartProcessingPayload,
  onProgress: (message: string) => void
): Promise<ProcessingResult> {
  assertRegisteredSession(payload.sessionId)

  if (payload.mode === 'notes-only') {
    return processNotesSession(payload, onProgress)
  }

  await finalizeSession(payload.sessionId)

  const baseConfig = loadConfig()
  const config = {
    ...baseConfig,
    driveFolderId: payload.driveDestination?.folderId || '',
    driveFolderLabel: payload.driveDestination?.pathLabel || '',
    driveId: payload.driveDestination?.driveId
  }
  const sessionDir = getSessionDir(config, payload.sessionId)
  const paths = sessionPaths(sessionDir, payload.title)

  validateRecordingFile(paths.webm)

  const session: RecordingSession = {
    id: payload.sessionId,
    title: payload.title,
    startedAt: payload.startedAt,
    hostEmail: payload.hostEmail,
    hostDisplayName: payload.hostDisplayName,
    participantNames: payload.participantNames,
    calendarEventId: payload.calendarEventId,
    hangoutLink: payload.hangoutLink,
    meetingCode: payload.meetingCode,
    status: 'processing',
    localMp4Path: paths.mp4,
    localTranscriptPath: paths.transcript,
    driveFolderId: payload.driveDestination?.folderId,
    driveFolderLabel: payload.driveDestination?.pathLabel
  }

  try {
    onProgress('Saving your video...')
    await convertWebmToMp4(config, paths.webm, paths.mp4)

    await stopMeetCaptionCapture()
    const captionLines = loadMeetCaptions(sessionDir)
    const sourceMedia = await probeMediaFile(config, paths.webm)
    onProgress('Checking for an official Google Meet transcript...')
    const meetArtifacts = await fetchMeetArtifacts(config, payload.meetingCode)
    const captionsWithNames =
      hasUsableMeetCaptions(captionLines) && captionsIncludeSpeakerNames(captionLines)

    if (meetArtifacts?.transcript) {
      onProgress('Saving the official transcript with participant names...')
      writeFileSync(paths.transcript, meetArtifacts.transcript, 'utf8')
    } else if (captionsWithNames) {
      onProgress('Saving transcript with participant names...')
      writeFileSync(paths.transcript, formatMeetCaptionTranscript(captionLines), 'utf8')
    } else if (sourceMedia.hasAudio) {
      onProgress('Writing the transcript...')
      const recordingMs = Date.now() - new Date(payload.startedAt).getTime()
      if (recordingMs > 45 * 60 * 1000) {
        onProgress('Writing the transcript… this may take several minutes for long meetings.')
      }
      await extractAudioWav(config, paths.webm, paths.wav)
      const localTranscript = await generateTranscript(config, paths.wav, paths.transcript)
      const host = payload.hostDisplayName || payload.hostEmail || 'Meeting host'
      const participants = [
        ...(meetArtifacts?.participantNames || []),
        ...(payload.participantNames || [])
      ]
        .filter((name) => name && name.toLowerCase() !== host.toLowerCase())
        .filter((name, index, all) => all.indexOf(name) === index)
      const identityHeader = [
        'Meeting transcript',
        '',
        `Host: ${host}`,
        participants.length ? `Participants: ${participants.join(', ')}` : '',
        'Speaker attribution was unavailable for this audio transcription; names are listed for context only.',
        '',
        localTranscript
      ]
        .filter((line, index) => line !== '' || index === 1 || index >= 5)
        .join('\n')
      writeFileSync(paths.transcript, identityHeader, 'utf8')
    } else {
      writeFileSync(
        paths.transcript,
        'No transcript was captured. Turn on Meet CC during the meeting, or check that meeting audio is audible on your computer.',
        'utf8'
      )
    }
    cleanupTempMedia({
      webm: paths.webm,
      wav: paths.wav
    })

    session.status = 'uploading'

    if (config.driveFolderId) {
      onProgress('Creating Google Drive folder...')
      const driveSessionFolderId = await ensureDriveSessionFolder(config, payload.sessionId)

      onProgress('Uploading to Google Drive...')
      session.driveVideoFileId = await uploadFileToDrive(
        config,
        paths.mp4,
        `${sanitizeFileName(payload.title)}.mp4`,
        'video/mp4',
        driveSessionFolderId
      )

      onProgress('Uploading transcript...')
      session.driveTranscriptFileId = await uploadFileToDrive(
        config,
        paths.transcript,
        `${sanitizeFileName(payload.title)}.txt`,
        'text/plain',
        driveSessionFolderId
      )

    }

    session.status = 'complete'
    await saveRecordingMetadata(config, session)

    const message = config.driveFolderId
      ? `Uploaded to Google Drive${config.driveFolderLabel ? `\nDestination: ${config.driveFolderLabel}` : ''}.\nA local backup was kept at:\n${sessionDir}`
      : `Saved on this computer.\n\n${sessionDir}`

    onProgress('All done!')
    unregisterSession(payload.sessionId)
    return {
      session,
      message
    }
  } catch (error) {
    // Preserve the source WebM (and any extracted audio) when processing fails.
    // It may be the only recoverable copy and is useful for support diagnostics.
    unregisterSession(payload.sessionId)
    session.status = 'error'
    session.error = error instanceof Error ? error.message : String(error)
    await saveRecordingMetadata(config, session)
    throw error
  }
}

async function processNotesSession(
  payload: StartProcessingPayload,
  onProgress: (message: string) => void
): Promise<ProcessingResult> {
  const baseConfig = loadConfig()
  const config = {
    ...baseConfig,
    driveFolderId: payload.driveDestination?.folderId || '',
    driveFolderLabel: payload.driveDestination?.pathLabel || '',
    driveId: payload.driveDestination?.driveId
  }
  const sessionDir = getSessionDir(config, payload.sessionId)
  const paths = sessionPaths(sessionDir, payload.title)

  const session: RecordingSession = {
    id: payload.sessionId,
    title: payload.title,
    startedAt: payload.startedAt,
    hostEmail: payload.hostEmail,
    calendarEventId: payload.calendarEventId,
    hangoutLink: payload.hangoutLink,
    meetingCode: payload.meetingCode,
    status: 'processing',
    localTranscriptPath: paths.transcript,
    driveFolderId: payload.driveDestination?.folderId,
    driveFolderLabel: payload.driveDestination?.pathLabel
  }

  try {
    onProgress('Saving your notes...')
    await stopMeetCaptionCapture()
    const captionLines = loadMeetCaptions(sessionDir)

    if (!hasUsableMeetCaptions(captionLines)) {
      throw new Error(
        'No meeting notes were captured. Open the meeting in the app, keep captions on, and try again.'
      )
    }

    onProgress('Saving transcript with participant names...')
    writeFileSync(paths.transcript, formatMeetCaptionTranscript(captionLines), 'utf8')

    cleanupTempMedia({
      webm: paths.webm,
      wav: paths.wav
    })

    session.status = 'uploading'

    if (config.driveFolderId) {
      onProgress('Creating Google Drive folder...')
      const driveSessionFolderId = await ensureDriveSessionFolder(config, payload.sessionId)

      onProgress('Uploading notes...')
      session.driveTranscriptFileId = await uploadFileToDrive(
        config,
        paths.transcript,
        `${sanitizeFileName(payload.title)}.txt`,
        'text/plain',
        driveSessionFolderId
      )

    }

    session.status = 'complete'
    await saveRecordingMetadata(config, session)

    const message = config.driveFolderId
      ? `Notes uploaded to Google Drive${config.driveFolderLabel ? `\nDestination: ${config.driveFolderLabel}` : ''}.\nA local backup was kept at:\n${sessionDir}`
      : `Notes saved on this computer.\n\n${sessionDir}`

    onProgress('All done!')
    unregisterSession(payload.sessionId)
    return {
      session,
      message
    }
  } catch (error) {
    cleanupTempMedia({
      webm: paths.webm,
      wav: paths.wav
    })
    unregisterSession(payload.sessionId)
    session.status = 'error'
    session.error = error instanceof Error ? error.message : String(error)
    await saveRecordingMetadata(config, session)
    throw error
  }
}

