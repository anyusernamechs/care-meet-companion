import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { AppConfig } from '../shared/types'
import {
  hasBundledTranscriptionTools,
  resolveFfmpegPath,
  resolveWhisperExecutable,
  resolveWhisperModelPath
} from './bundled-tools'
import { loadDriveDestination } from './services/drive-settings'
import { resolveRecordingsDirectory } from './services/recordings-settings'
import { resolveSessionDir } from './paths'

function resolveGoogleAppId(clientId: string): string {
  const fromEnv = process.env.GOOGLE_APP_ID?.trim()
  if (fromEnv) return fromEnv
  const match = clientId.match(/^(\d+)-/)
  return match?.[1] ?? ''
}

export function loadConfig(): AppConfig {
  const recordingsDir = resolveRecordingsDirectory()
  if (!existsSync(recordingsDir)) {
    mkdirSync(recordingsDir, { recursive: true })
  }

  const savedDrive = loadDriveDestination()

  return {
    recordingsDir,
    synologyPath: process.env.CARE_SYNOLOGY_PATH || undefined,
    ffmpegPath: resolveFfmpegPath(process.env.CARE_FFMPEG_PATH),
    whisperPath: resolveWhisperExecutable(process.env.CARE_WHISPER_PATH),
    whisperModelPath: resolveWhisperModelPath(process.env.CARE_WHISPER_MODEL_PATH),
    whisperEnabled: process.env.CARE_WHISPER_ENABLED !== 'false',
    bundledToolsReady: hasBundledTranscriptionTools(),
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://127.0.0.1:42813/oauth2callback',
    googleApiKey: process.env.GOOGLE_API_KEY || process.env.FIREBASE_API_KEY || '',
    googleAppId: resolveGoogleAppId(process.env.GOOGLE_CLIENT_ID || ''),
    driveFolderId: savedDrive?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    driveFolderLabel: savedDrive?.pathLabel || '',
    driveId: savedDrive?.driveId,
    firebaseApiKey: process.env.FIREBASE_API_KEY || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseAppId: process.env.FIREBASE_APP_ID || ''
  }
}

export function getSessionDir(config: AppConfig, sessionId: string): string {
  const recordingsRoot =
    config.synologyPath && existsSync(config.synologyPath)
      ? config.synologyPath
      : config.recordingsDir
  const base = resolveSessionDir(recordingsRoot, sessionId)

  if (!existsSync(base)) {
    mkdirSync(base, { recursive: true })
  }
  return base
}
