import { google } from 'googleapis'
import { createReadStream } from 'fs'
import type { AppConfig } from '../../shared/types'
import { getAuthorizedClient } from './google-auth'

export { getAuthStatus, startGoogleAuth } from './google-auth'

export async function uploadFileToDrive(
  config: AppConfig,
  localPath: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (!config.driveFolderId) {
    throw new Error('No Google Drive folder selected.')
  }

  const auth = await getAuthorizedClient(config)
  const drive = google.drive({ version: 'v3', auth })

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [config.driveFolderId]
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
