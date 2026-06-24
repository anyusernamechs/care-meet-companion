import { app } from 'electron'
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

function resolvePath(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  return value.replace(/^~/, app.getPath('home'))
}

export function loadConfig(): AppConfig {
  const defaultRecordingsDir = join(app.getPath('documents'), 'CARE Meet Recordings')

  const recordingsDir = resolvePath(process.env.CARE_RECORDINGS_DIR, defaultRecordingsDir)
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
    driveFolderId: savedDrive?.folderId || process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    driveFolderLabel: savedDrive?.pathLabel || '',
    driveId: savedDrive?.driveId,
    googleChatWebhookUrl: process.env.GOOGLE_CHAT_WEBHOOK_URL || undefined,
    firebaseApiKey: process.env.FIREBASE_API_KEY || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseAppId: process.env.FIREBASE_APP_ID || '',
    notifyEmail: process.env.CARE_NOTIFY_EMAIL || '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || ''
  }
}

export function getSessionDir(config: AppConfig, sessionId: string): string {
  const base = config.synologyPath && existsSync(config.synologyPath)
    ? join(config.synologyPath, sessionId)
    : join(config.recordingsDir, sessionId)

  if (!existsSync(base)) {
    mkdirSync(base, { recursive: true })
  }
  return base
}
