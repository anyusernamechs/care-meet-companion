import { google, type meet_v2 } from 'googleapis'
import type { AppConfig } from '../../shared/types'
import { log } from '../logger'
import { getAuthorizedClient } from './google-auth'

export interface MeetArtifactResult {
  transcript?: string
  participantNames: string[]
}

function displayName(participant: meet_v2.Schema$Participant): string | undefined {
  return (
    participant.signedinUser?.displayName ||
    participant.anonymousUser?.displayName ||
    participant.phoneUser?.displayName ||
    undefined
  )
}

function formatEntryTime(value?: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  })
}

export async function fetchMeetArtifacts(
  config: AppConfig,
  meetingCode?: string
): Promise<MeetArtifactResult | null> {
  const code = meetingCode?.trim().toLowerCase()
  if (!code || !/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(code)) return null

  try {
    const auth = await getAuthorizedClient(config)
    const meet = google.meet({ version: 'v2', auth })
    const records = await meet.conferenceRecords.list({
      filter: `space.meeting_code = "${code}"`,
      pageSize: 10
    })
    const record = records.data.conferenceRecords?.[0]
    if (!record?.name) return null

    const participantMap = new Map<string, string>()
    let participantToken: string | undefined
    do {
      const response = await meet.conferenceRecords.participants.list({
        parent: record.name,
        pageSize: 250,
        pageToken: participantToken
      })
      for (const participant of response.data.participants || []) {
        const name = displayName(participant)
        if (participant.name && name) participantMap.set(participant.name, name)
      }
      participantToken = response.data.nextPageToken || undefined
    } while (participantToken)

    const transcriptResponse = await meet.conferenceRecords.transcripts.list({
      parent: record.name,
      pageSize: 100
    })
    const transcriptResource = transcriptResponse.data.transcripts?.at(-1)
    if (!transcriptResource?.name) {
      return { participantNames: [...new Set(participantMap.values())] }
    }

    const entries: meet_v2.Schema$TranscriptEntry[] = []
    let entryToken: string | undefined
    do {
      const response = await meet.conferenceRecords.transcripts.entries.list({
        parent: transcriptResource.name,
        pageSize: 100,
        pageToken: entryToken
      })
      entries.push(...(response.data.transcriptEntries || []))
      entryToken = response.data.nextPageToken || undefined
    } while (entryToken)

    if (!entries.length) return { participantNames: [...new Set(participantMap.values())] }

    const body = entries
      .filter((entry) => entry.text?.trim())
      .map((entry) => {
        const speaker = participantMap.get(entry.participant || '') || 'Participant'
        return `[${formatEntryTime(entry.startTime)}] ${speaker}: ${entry.text?.trim()}`
      })
      .join('\n\n')

    return {
      participantNames: [...new Set(participantMap.values())],
      transcript: ['Meeting transcript', '', body].join('\n')
    }
  } catch (error) {
    log.warn('meet-artifacts', 'Meet artifacts unavailable; using local fallback', error)
    return null
  }
}
