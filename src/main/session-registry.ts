const activeSessions = new Set<string>()

export function registerSession(sessionId: string): void {
  activeSessions.add(sessionId)
}

export function unregisterSession(sessionId: string): void {
  activeSessions.delete(sessionId)
}

export function assertRegisteredSession(sessionId: string): void {
  if (!activeSessions.has(sessionId)) {
    throw new Error('This recording session is not active or has already finished.')
  }
}

export function clearSessions(): void {
  activeSessions.clear()
}
