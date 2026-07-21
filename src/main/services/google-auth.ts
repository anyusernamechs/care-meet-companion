import { randomBytes } from 'crypto'
import { BrowserWindow, app, nativeImage } from 'electron'
import { createServer, type Server } from 'http'
import { URL } from 'url'
import { google } from 'googleapis'
import type { AppConfig } from '../../shared/types'
import { getBrandingPath } from '../branding'
import { log } from '../logger'
import { GOOGLE_SESSION_PARTITION } from '../meet-view'
import { clearTokens, loadTokens, saveTokens } from '../token-storage'

export const GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly'
]

const OAUTH_TIMEOUT_MS = 5 * 60 * 1000

function allowedEmailDomain(): string {
  return (process.env.CARE_ALLOWED_EMAIL_DOMAIN || 'carehelps.ca').toLowerCase()
}

export function isAllowedWorkspaceEmail(email: string | undefined | null): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${allowedEmailDomain()}`)
}

export function displayNameFromEmail(email: string): string {
  const local = email.split('@')[0] || email
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function resolveHostDisplayName(email?: string, profileName?: string): string | undefined {
  const name = profileName?.trim()
  if (name) return name
  if (email) return displayNameFromEmail(email)
  return undefined
}

export function createOAuthClient(config: AppConfig) {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  )
}

export async function getAuthStatus(
  config: AppConfig
): Promise<{ authenticated: boolean; email?: string; name?: string }> {
  const tokens = loadTokens()
  if (!tokens?.refresh_token) {
    return { authenticated: false }
  }

  if (!isAllowedWorkspaceEmail(tokens.email)) {
    clearTokens()
    return { authenticated: false }
  }

  const client = createOAuthClient(config)
  client.setCredentials(tokens)

  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const profile = await oauth2.userinfo.get()
    const email = profile.data.email || tokens.email
    if (!isAllowedWorkspaceEmail(email)) {
      clearTokens()
      return { authenticated: false }
    }

    const name = profile.data.name || tokens.name
    saveTokens({
      ...tokens,
      email: email || undefined,
      name: name || undefined
    })

    return {
      authenticated: true,
      email: email || undefined,
      name: resolveHostDisplayName(email, name)
    }
  } catch {
    const fallback = resolveHostDisplayName(tokens.email, tokens.name)
    return fallback
      ? { authenticated: true, email: tokens.email, name: fallback }
      : { authenticated: false }
  }
}

export function getHostDisplayName(): string | undefined {
  const tokens = loadTokens()
  return resolveHostDisplayName(tokens?.email, tokens?.name)
}

export async function startGoogleAuth(
  config: AppConfig,
  parentWindow?: BrowserWindow | null
): Promise<{ success: boolean; email?: string; error?: string }> {
  if (!config.googleClientId) {
    return {
      success: false,
      error: 'Google sign-in is not configured yet. Contact your IT team.'
    }
  }

  const client = createOAuthClient(config)
  const existing = loadTokens()
  const oauthState = randomBytes(24).toString('hex')
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: existing?.refresh_token ? undefined : 'consent',
    scope: GOOGLE_SCOPES,
    state: oauthState,
    hd: allowedEmailDomain(),
    login_hint: existing?.email,
    include_granted_scopes: true
  })

  return new Promise((resolve) => {
    let server: Server | null = null
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const redirect = new URL(config.googleRedirectUri)
    const port = Number(redirect.port || 42813)

    const finish = (result: { success: boolean; email?: string; error?: string }) => {
      if (settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      server?.close()
      if (!authWindow.isDestroyed()) {
        authWindow.close()
      }
      resolve(result)
    }

    const authWindow = new BrowserWindow({
      width: 520,
      height: 760,
      parent: parentWindow ?? undefined,
      modal: Boolean(parentWindow),
      title: 'Sign in — CARE Meet Companion',
      autoHideMenuBar: true,
      icon: (() => {
        const image = nativeImage.createFromPath(getBrandingPath('logo.png'))
        return image.isEmpty() ? undefined : image
      })(),
      webPreferences: {
        partition: GOOGLE_SESSION_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })

    const handleRedirect = async (targetUrl: string): Promise<void> => {
      if (!targetUrl.startsWith(config.googleRedirectUri)) {
        return
      }

      const requestUrl = new URL(targetUrl)
      const code = requestUrl.searchParams.get('code')
      const error = requestUrl.searchParams.get('error')
      const state = requestUrl.searchParams.get('state')

      if (state !== oauthState) {
        finish({ success: false, error: 'Sign-in validation failed. Please try again.' })
        return
      }

      if (error || !code) {
        finish({ success: false, error: error || 'Sign-in was cancelled.' })
        return
      }

      try {
        const { tokens } = await client.getToken(code)
        client.setCredentials(tokens)

        const oauth2 = google.oauth2({ version: 'v2', auth: client })
        const profile = await oauth2.userinfo.get()
        const email = profile.data.email || undefined
        const name = profile.data.name || undefined

        if (!isAllowedWorkspaceEmail(email)) {
          clearTokens()
          finish({
            success: false,
            error: `Sign in with your @${allowedEmailDomain()} Google account.`
          })
          return
        }

        saveTokens({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          email,
          name: name || undefined
        })

        finish({ success: true, email })
      } catch (authError) {
        log.error('auth', 'OAuth token exchange failed', authError)
        finish({
          success: false,
          error: authError instanceof Error ? authError.message : String(authError)
        })
      }
    }

    authWindow.webContents.on('will-redirect', (_event, url) => {
      void handleRedirect(url)
    })

    authWindow.webContents.on('will-navigate', (_event, url) => {
      void handleRedirect(url)
    })

    authWindow.on('closed', () => {
      if (!settled) {
        finish({ success: false, error: 'Sign-in window was closed.' })
      }
    })

    server = createServer(async (req, res) => {
      try {
        if (!req.url?.startsWith(redirect.pathname)) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const requestUrl = new URL(req.url, config.googleRedirectUri)
        const code = requestUrl.searchParams.get('code')
        const error = requestUrl.searchParams.get('error')

        if (error || !code) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<h1>Sign-in failed.</h1><p>You can close this window.</p>')
          void handleRedirect(requestUrl.toString())
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(
          '<h1>Signed in successfully.</h1><p>You can close this window and return to CARE Meet Companion.</p>'
        )
        void handleRedirect(requestUrl.toString())
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/html' })
        res.end('<h1>Sign-in failed.</h1>')
      }
    })

    server.listen(port, '127.0.0.1', () => {
      void authWindow.loadURL(authUrl)
    })

    timeoutId = setTimeout(() => {
      finish({ success: false, error: 'Sign-in timed out. Please try again.' })
    }, OAUTH_TIMEOUT_MS)
  })
}

export async function signOutGoogle(config: AppConfig): Promise<void> {
  const tokens = loadTokens()
  const token = tokens?.refresh_token || tokens?.access_token

  try {
    if (token && config.googleClientId) {
      const client = createOAuthClient(config)
      await client.revokeToken(token)
    }
  } catch (error) {
    log.warn('auth', 'Google token revocation failed; clearing the local session', error)
  } finally {
    clearTokens()
  }
}

export async function getAuthorizedClient(config: AppConfig) {
  const tokens = loadTokens()
  if (!tokens?.refresh_token) {
    throw new Error('Google account not connected. Click Connect first.')
  }

  if (!isAllowedWorkspaceEmail(tokens.email)) {
    clearTokens()
    throw new Error(`Connect with your @${allowedEmailDomain()} Google account.`)
  }

  const client = createOAuthClient(config)
  client.setCredentials(tokens)
  client.on('tokens', (freshTokens) => {
    saveTokens({ ...tokens, ...freshTokens })
  })

  return client
}
