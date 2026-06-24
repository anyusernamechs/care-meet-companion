import { google } from 'googleapis'
import type { AppConfig, DriveFolderEntry, DriveRootEntry } from '../../shared/types'
import { getAuthorizedClient } from './google-auth'

export async function listDriveRoots(config: AppConfig): Promise<DriveRootEntry[]> {
  const auth = await getAuthorizedClient(config)
  const drive = google.drive({ version: 'v3', auth })

  const roots: DriveRootEntry[] = [{ id: 'root', name: 'My Drive' }]

  let pageToken: string | undefined
  do {
    const response = await drive.drives.list({
      pageSize: 100,
      pageToken,
      fields: 'nextPageToken, drives(id, name)'
    })

    for (const entry of response.data.drives || []) {
      if (entry.id && entry.name) {
        roots.push({ id: entry.id, name: entry.name, driveId: entry.id })
      }
    }

    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)

  return roots
}

export async function listDriveFolders(
  config: AppConfig,
  parentId: string,
  driveId?: string
): Promise<DriveFolderEntry[]> {
  if (!/^[a-zA-Z0-9_-]+$/.test(parentId)) {
    throw new Error('Invalid folder id.')
  }
  if (driveId && !/^[a-zA-Z0-9_-]+$/.test(driveId)) {
    throw new Error('Invalid shared drive id.')
  }

  const auth = await getAuthorizedClient(config)
  const drive = google.drive({ version: 'v3', auth })

  const response = await drive.files.list({
    q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    orderBy: 'name',
    pageSize: 200,
    corpora: driveId ? 'drive' : 'user',
    driveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  })

  return (response.data.files || [])
    .filter((file): file is { id: string; name: string } => Boolean(file.id && file.name))
    .map((file) => ({ id: file.id, name: file.name }))
}
