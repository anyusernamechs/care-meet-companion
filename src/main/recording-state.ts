let recordingActive = false

export function setRecordingActive(active: boolean): void {
  recordingActive = active
}

export function isRecordingActive(): boolean {
  return recordingActive
}
