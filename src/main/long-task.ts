let longTaskActive = false

export function setLongTaskActiveFlag(active: boolean): void {
  longTaskActive = active
}

export function isLongTaskActive(): boolean {
  return longTaskActive
}
