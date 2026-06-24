import { google } from 'googleapis'
import { createReadStream } from 'fs'
import type { AppConfig } from '../../shared/types'
import { log } from '../logger'
import { getAuthorizedClient } from './google-auth'

export { getAuthStatus, startGoogleAuth } from './google-auth'

const UPLOAD_MARKER = '.care-meet-companion-upload-marker'
const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

function escapeDriveQueryString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function driveSessionFolderName(value: string): string {
  const trimmed = value.trim().slice(0, 200)
  return trimmed || 'Meeting'
}

export async function establishFolderAccess(config: AppConfig, folderId: string): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    throw new Error('Invalid Drive folder id.')
  }

  const auth = await getAuthorizedClient(config)
  const drive = google.drive({ version: 'v3', auth })

  const existing = await drive.files.list({
    q: `name='${UPLOAD_MARKER}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  })

  if (existing.data.files?.[0]?.id) {
    return
  }

  await drive.files.create({
    requestBody: {
      name: UPLOAD_MARKER,
      parents: [folderId],
      description: 'CARE Meet Companion upload destination marker'
    },
    media: {
      mimeType: 'text/plain',
      body: 'CARE Meet Companion'
    },
    supportsAllDrives: true
  })

  log.info('drive', `Established upload access for folder ${folderId}`)
}

export async function ensureDriveSessionFolder(
  config: AppConfig,
  sessionFolderName: string
): Promise<string> {
  if (!config.driveFolderId) {
    throw new Error('No Google Drive folder selected.')
  }

  const folderName = driveSessionFolderName(sessionFolderName)
  await establishFolderAccess(config, config.driveFolderId)

  const auth = await getAuthorizedClient(config)
  const drive = google.drive({ version: 'v3', auth })
  const parentId = config.driveFolderId
  const safeName = escapeDriveQueryString(folderName)

  const existing = await drive.files.list({
    q: `name='${safeName}' and '${parentId}' in parents and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  })

  const existingId = existing.data.files?.[0]?.id
  if (existingId) {
    return existingId
  }

  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: DRIVE_FOLDER_MIME,
      parents: [parentId]
    },
    supportsAllDrives: true,
    fields: 'id'
  })

  if (!response.data.id) {
    throw new Error('Could not create a Google Drive folder for this session.')
  }

  log.info('drive', `Created session folder "${folderName}" (${response.data.id})`)
  return response.data.id
}

export async function uploadFileToDrive(
  config: AppConfig,
  localPath: string,
  fileName: string,
  mimeType: string,
  parentFolderId?: string
): Promise<string> {
  if (!config.driveFolderId) {
    throw new Error('No Google Drive folder selected.')
  }

  const destinationId = parentFolderId || config.driveFolderId
  await establishFolderAccess(config, config.driveFolderId)

  const auth = await getAuthorizedClient(config)
  const drive = google.drive({ version: 'v3', auth })

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [destinationId]
    },
    media: {
      mimeType,
      body: createReadStream(localPath)
    },
    supportsAllDrives: true,
    fields: 'id, webViewLink'
  })

  if (!response.data.id) {
    throw new Error('Upload finished but Google Drive did not return a file link.')
  }

  return response.data.id
}
