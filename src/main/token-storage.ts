import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface StoredTokens {
  access_token?: string | null
  refresh_token?: string | null
  expiry_date?: number | null
  email?: string
  name?: string
}

const TOKEN_FILE = 'google-tokens.json'
const ENCRYPTED_FILE = 'google-tokens.enc'

function tokenDir(): string {
  return app.getPath('userData')
}

function legacyPath(): string {
  return join(tokenDir(), TOKEN_FILE)
}

function encryptedPath(): string {
  return join(tokenDir(), ENCRYPTED_FILE)
}

function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

function migrateLegacyTokens(): StoredTokens | null {
  const path = legacyPath()
  if (!existsSync(path)) return null

  try {
    const tokens = JSON.parse(readFileSync(path, 'utf8')) as StoredTokens
    saveTokens(tokens)
    unlinkSync(path)
    return tokens
  } catch {
    return null
  }
}

export function loadTokens(): StoredTokens | null {
  migrateLegacyTokens()

  const path = encryptedPath()
  if (!existsSync(path)) return null

  try {
    const raw = readFileSync(path)
    if (canEncrypt()) {
      return JSON.parse(safeStorage.decryptString(raw)) as StoredTokens
    }
    return JSON.parse(raw.toString('utf8')) as StoredTokens
  } catch {
    return null
  }
}

export function saveTokens(tokens: StoredTokens): void {
  const payload = JSON.stringify(tokens, null, 2)
  const path = encryptedPath()

  if (canEncrypt()) {
    writeFileSync(path, safeStorage.encryptString(payload))
    return
  }

  writeFileSync(path, payload, 'utf8')
}

export function clearTokens(): void {
  for (const path of [encryptedPath(), legacyPath()]) {
    if (existsSync(path)) {
      try {
        unlinkSync(path)
      } catch {
        // ignore
      }
    }
  }
}
