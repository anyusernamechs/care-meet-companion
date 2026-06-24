import nodemailer from 'nodemailer'
import type { AppConfig } from '../../shared/types'
import type { RecordingSession } from '../../shared/types'

function buildSummaryLines(session: RecordingSession): string[] {
  return [
    `Meeting: ${session.title}`,
    session.hostEmail ? `Host: ${session.hostEmail}` : '',
    session.calendarEventId ? `Calendar event: ${session.calendarEventId}` : '',
    session.hangoutLink ? `Meet link: ${session.hangoutLink}` : '',
    `Recording ID: ${session.id}`,
    `Status: ${session.status}`,
    session.driveVideoFileId ? `Drive video file ID: ${session.driveVideoFileId}` : '',
    session.driveTranscriptFileId ? `Drive transcript file ID: ${session.driveTranscriptFileId}` : '',
    session.localMp4Path ? `Local copy: ${session.localMp4Path}` : ''
  ].filter(Boolean)
}

async function sendEmailNotification(config: AppConfig, session: RecordingSession): Promise<void> {
  if (!config.notifyEmail || !config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  })

  await transporter.sendMail({
    from: config.smtpUser,
    to: config.notifyEmail,
    subject: `CARE recording saved: ${session.title}`,
    text: ['Your meeting recording has been processed and uploaded.', '', ...buildSummaryLines(session)].join('\n')
  })
}

async function sendChatNotification(config: AppConfig, session: RecordingSession): Promise<void> {
  if (!config.googleChatWebhookUrl) {
    return
  }

  const lines = buildSummaryLines(session)
  const response = await fetch(config.googleChatWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      text: ['*CARE Meet Companion*', 'Recording saved to Drive. Transcript saved.', '', ...lines].join('\n')
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google Chat webhook failed (${response.status}): ${body}`)
  }
}

export async function notifyHost(config: AppConfig, session: RecordingSession): Promise<void> {
  await Promise.allSettled([sendEmailNotification(config, session), sendChatNotification(config, session)])
}
