import { describe, expect, it } from 'vitest'
import { labelTranscriptWithSpeakers, speakerAtOffset } from './meet-speakers'

describe('speakerAtOffset', () => {
  const startedAt = '2026-07-21T22:33:00.000Z'
  const segments = [
    {
      speaker: 'Libin Varghese',
      startedAt: '2026-07-21T22:33:01.000Z',
      endedAt: '2026-07-21T22:33:05.000Z'
    },
    {
      speaker: 'Nivin Markose',
      startedAt: '2026-07-21T22:33:06.000Z',
      endedAt: '2026-07-21T22:33:10.000Z'
    }
  ]

  it('returns the speaker active at a recording offset', () => {
    expect(speakerAtOffset(segments, startedAt, 2500)).toBe('Libin Varghese')
    expect(speakerAtOffset(segments, startedAt, 7500)).toBe('Nivin Markose')
  })
})

describe('labelTranscriptWithSpeakers', () => {
  it('labels whisper SRT cues from Meet tile speaker timeline', () => {
    const startedAt = '2026-07-21T22:33:00.000Z'
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'One, two, three.',
      '',
      '2',
      '00:00:06,500 --> 00:00:08,000',
      'Okay, thanks.'
    ].join('\n')

    const labeled = labelTranscriptWithSpeakers(
      srt,
      'One, two, three.\nOkay, thanks.',
      {
        sessionId: 'test',
        startedAt,
        roster: ['Libin Varghese', 'Nivin Markose'],
        segments: [
          {
            speaker: 'Libin Varghese',
            startedAt: '2026-07-21T22:33:01.000Z',
            endedAt: '2026-07-21T22:33:05.000Z'
          },
          {
            speaker: 'Nivin Markose',
            startedAt: '2026-07-21T22:33:06.000Z',
            endedAt: '2026-07-21T22:33:10.000Z'
          }
        ]
      },
      startedAt
    )

    expect(labeled).toContain('Libin Varghese:')
    expect(labeled).toContain('One, two, three.')
    expect(labeled).toContain('Nivin Markose:')
    expect(labeled).toContain('Okay, thanks.')
  })

  it('falls back to plain text when no speaker segments exist', () => {
    expect(
      labelTranscriptWithSpeakers('1\n00:00:00,000 --> 00:00:01,000\nHi', 'Hi', {
        sessionId: 'test',
        roster: [],
        segments: []
      }, '2026-07-21T22:33:00.000Z')
    ).toBe('Hi')
  })
})
