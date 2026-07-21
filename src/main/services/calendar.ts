import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis'
import type { AppConfig } from '../../shared/types'
import type { CalendarMeeting } from '../../shared/types'
import { getAuthorizedClient } from './google-auth'

const MEET_PATTERNS = [
  /meet\.google\.com\/([a-z-]+)/i,
  /https:\/\/meet\.google\.com\/([a-z-]+)/i,
  /meet code[:\s]+([a-z-]+)/i
]

export function extractMeetingCode(text: string): string | undefined {
  for (const pattern of MEET_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }
  return undefined
}

function hasMeetLink(event: calendar_v3.Schema$Event): boolean {
  if (event.hangoutLink) return true
  if (event.conferenceData?.entryPoints?.some((entry) => entry.entryPointType === 'video')) {
    return true
  }
  return Boolean(extractMeetingCode(event.description || event.location || ''))
}

function resolveHangoutLink(event: calendar_v3.Schema$Event): string | undefined {
  if (event.hangoutLink) return event.hangoutLink

  const videoEntry = event.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === 'video' && entry.uri
  )
  if (videoEntry?.uri) return videoEntry.uri

  const code = extractMeetingCode(event.description || event.location || '')
  return code ? `https://meet.google.com/${code}` : undefined
}

function mapEvent(event: calendar_v3.Schema$Event): CalendarMeeting | null {
  if (!event.id || !event.start?.dateTime || !event.end?.dateTime) {
    return null
  }
  if (!hasMeetLink(event)) {
    return null
  }

  const startTime = new Date(event.start.dateTime)
  const endTime = new Date(event.end.dateTime)
  const now = new Date()
  const hangoutLink = resolveHangoutLink(event)
  const meetingCode = hangoutLink ? extractMeetingCode(hangoutLink) : undefined

  return {
    id: event.id,
    title: event.summary || 'Untitled Meeting',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    hangoutLink,
    meetingCode,
    organizerEmail: event.organizer?.email || undefined,
    organizerName: event.organizer?.displayName || undefined,
    attendeeNames: (event.attendees || [])
      .filter((attendee) => !attendee.self && attendee.responseStatus !== 'declined')
      .map((attendee) => attendee.displayName || attendee.email || '')
      .filter(Boolean),
    isActive: now >= startTime && now <= endTime,
    isUpcoming: now < startTime
  }
}

export async function listCalendarMeetings(
  config: AppConfig,
  hoursAhead = 24
): Promise<CalendarMeeting[]> {
  const auth = await getAuthorizedClient(config)
  const calendar = google.calendar({ version: 'v3', auth })

  const now = new Date()
  const timeMax = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 20
  })

  return (response.data.items || [])
    .map(mapEvent)
    .filter((meeting): meeting is CalendarMeeting => meeting !== null)
}

export async function getCurrentOrNextMeeting(
  config: AppConfig
): Promise<CalendarMeeting | null> {
  const meetings = await listCalendarMeetings(config)
  const active = meetings.find((meeting) => meeting.isActive)
  if (active) return active
  return meetings.find((meeting) => meeting.isUpcoming) || null
}
