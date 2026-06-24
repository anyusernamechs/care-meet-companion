import { initializeApp } from 'firebase/app'
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { AppConfig } from '../../shared/types'
import type { RecordingSession } from '../../shared/types'

let initialized = false
let db: ReturnType<typeof getFirestore> | null = null

function ensureFirebase(config: AppConfig): ReturnType<typeof getFirestore> | null {
  if (!config.firebaseApiKey || !config.firebaseProjectId || !config.firebaseAppId) {
    return null
  }

  if (!initialized) {
    const app = initializeApp({
      apiKey: config.firebaseApiKey,
      projectId: config.firebaseProjectId,
      appId: config.firebaseAppId
    })
    db = getFirestore(app)
    initialized = true
  }

  return db
}

export async function saveRecordingMetadata(
  config: AppConfig,
  session: RecordingSession
): Promise<void> {
  const firestore = ensureFirebase(config)
  if (!firestore) return

  const collectionPath = session.hostEmail
    ? `users/${encodeURIComponent(session.hostEmail)}/recordings`
    : 'recordings'

  await setDoc(doc(firestore, collectionPath, session.id), {
    title: session.title,
    startedAt: session.startedAt,
    status: session.status,
    hostEmail: session.hostEmail || null,
    calendarEventId: session.calendarEventId || null,
    hangoutLink: session.hangoutLink || null,
    meetingCode: session.meetingCode || null,
    driveVideoFileId: session.driveVideoFileId || null,
    driveTranscriptFileId: session.driveTranscriptFileId || null,
    source: 'care-meet-companion-desktop',
    updatedAt: serverTimestamp()
  })
}
