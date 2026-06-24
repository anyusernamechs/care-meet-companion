import type { WebContents } from 'electron'
import type { MeetCallEndedReason } from '../shared/types'
import { getMeetView } from './meet-view'

export const MEET_CALL_URL =
  /meet\.google\.com\/[a-z]{3,4}-[a-z]{4}-[a-z]{3,4}/i

type MeetCallEndedListener = (reason: MeetCallEndedReason) => void

const listeners = new Set<MeetCallEndedListener>()
let wasInCall = false
let consecutiveLeft = 0
let emitted = false

export function onMeetCallEnded(listener: MeetCallEndedListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emitCallEnded(reason: MeetCallEndedReason): void {
  if (emitted) return
  emitted = true
  for (const listener of listeners) {
    listener(reason)
  }
}

export function resetMeetCallMonitor(): void {
  wasInCall = false
  consecutiveLeft = 0
  emitted = false
}

export function markMeetCallActive(): void {
  const view = getMeetView()
  const url = view?.webContents.getURL() || ''
  wasInCall = MEET_CALL_URL.test(url)
  consecutiveLeft = 0
  emitted = false
}

export function checkMeetUrlForCallEnd(url: string): void {
  const inCall = MEET_CALL_URL.test(url)
  if (wasInCall && !inCall) {
    emitCallEnded('navigated-away')
    wasInCall = false
    return
  }
  if (inCall) {
    wasInCall = true
    consecutiveLeft = 0
  }
}

export function installMeetNavigationMonitor(webContents: WebContents): void {
  const onNavigate = (_event: Electron.Event, url: string) => {
    checkMeetUrlForCallEnd(url)
  }

  webContents.on('did-navigate', onNavigate)
  webContents.on('did-navigate-in-page', onNavigate)
}

export function reportMeetCallState(state: 'in-call' | 'left' | 'unknown'): void {
  if (emitted) return

  if (state === 'in-call') {
    wasInCall = true
    consecutiveLeft = 0
    return
  }

  if (state === 'left' && wasInCall) {
    consecutiveLeft += 1
    if (consecutiveLeft >= 2) {
      emitCallEnded('left-meeting')
    }
    return
  }

  if (state === 'unknown') {
    consecutiveLeft = 0
  }
}
