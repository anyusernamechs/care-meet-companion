import { describe, expect, it } from 'vitest'
import { filterCaptionsForTranscript } from './meet-captions'
import { assertSafeSessionId, resolveSessionDir } from './paths'
import { isAllowedMeetUrl, normalizeMeetUrl } from './url-policy'

describe('assertSafeSessionId', () => {
  it('accepts normal session folder names', () => {
    expect(() => assertSafeSessionId('IT Check In - 2026-06-24 1120')).not.toThrow()
  })

  it('rejects traversal', () => {
    expect(() => assertSafeSessionId('../secrets')).toThrow()
    expect(() => assertSafeSessionId('foo/bar')).toThrow()
  })
})

describe('resolveSessionDir', () => {
  it('keeps sessions inside recordings root', () => {
    const root = 'C:\\Users\\test\\Documents\\CARE Meet Recordings'
    const dir = resolveSessionDir(root, 'Meeting - 2026-06-24 1200')
    expect(dir.startsWith(root)).toBe(true)
  })

  it('rejects escaping paths', () => {
    expect(() => resolveSessionDir('C:\\recordings', '..\\windows')).toThrow()
  })
})

describe('meet url policy', () => {
  it('allows meet links', () => {
    expect(isAllowedMeetUrl('https://meet.google.com/abc-defg-hij')).toBe(true)
    expect(normalizeMeetUrl('https://meet.google.com/abc-defg-hij')).toBe(
      'https://meet.google.com/abc-defg-hij'
    )
  })

  it('blocks other hosts', () => {
    expect(isAllowedMeetUrl('https://evil.example/phish')).toBe(false)
    expect(() => normalizeMeetUrl('https://evil.example/phish')).toThrow()
  })
})

describe('filterCaptionsForTranscript', () => {
  const at = '2026-06-24T18:38:41.000Z'

  it('strips speaker name glued to caption text', () => {
    const out = filterCaptionsForTranscript([
      { speaker: 'Nivin Markose', text: 'Nivin MarkoseBye-bye.', at }
    ])
    expect(out).toEqual([{ speaker: 'Nivin Markose', text: 'Bye-bye.', at }])
  })

  it('drops Meet leave-call UI chrome', () => {
    const out = filterCaptionsForTranscript([
      { speaker: 'Libin Varghese', text: 'Hi, how are you?', at },
      { speaker: 'Participant', text: 'Returning to home screen in 60 seconds.', at },
      { speaker: 'Participant', text: '50 seconds left', at }
    ])
    expect(out).toEqual([{ speaker: 'Libin Varghese', text: 'Hi, how are you?', at }])
  })

  it('does not collapse unrelated lines that share a short prefix', () => {
    const out = filterCaptionsForTranscript([
      { speaker: 'Nivin Markose', text: 'No.', at },
      { speaker: 'Nivin Markose', text: 'Not only but also.', at: '2026-06-24T18:39:00.000Z' }
    ])
    expect(out).toHaveLength(2)
    expect(out[1]?.text).toBe('Not only but also.')
  })
})
