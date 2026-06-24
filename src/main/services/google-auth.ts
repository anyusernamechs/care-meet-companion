import { BrowserWindow, app, nativeImage } from 'electron'
import { createServer, type Server } from 'http'
import { URL } from 'url'
import { google } from 'googleapis'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { AppConfig } from '../../shared/types'
import { getBrandingPath } from '../branding'
import { GOOGLE_SESSION_PARTITION } from '../meet-view'



export const GOOGLE_SCOPES = [

  'openid',

  'https://www.googleapis.com/auth/userinfo.email',

  'https://www.googleapis.com/auth/calendar.readonly',

  'https://www.googleapis.com/auth/drive'

]



interface StoredTokens {

  access_token?: string | null

  refresh_token?: string | null

  expiry_date?: number | null

  email?: string

}



function tokenPath(): string {

  return join(app.getPath('userData'), 'google-tokens.json')

}



function loadTokens(): StoredTokens | null {

  const path = tokenPath()

  if (!existsSync(path)) return null

  return JSON.parse(readFileSync(path, 'utf8')) as StoredTokens

}



function saveTokens(tokens: StoredTokens): void {

  writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2), 'utf8')

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

): Promise<{ authenticated: boolean; email?: string }> {

  const tokens = loadTokens()

  if (!tokens?.refresh_token) {

    return { authenticated: false }

  }



  const client = createOAuthClient(config)

  client.setCredentials(tokens)



  try {

    const oauth2 = google.oauth2({ version: 'v2', auth: client })

    const profile = await oauth2.userinfo.get()

    return { authenticated: true, email: profile.data.email || tokens.email }

  } catch {

    return { authenticated: false }

  }

}



export async function startGoogleAuth(

  config: AppConfig,

  parentWindow?: BrowserWindow | null

): Promise<{ success: boolean; email?: string; error?: string }> {

  if (!config.googleClientId || !config.googleClientSecret) {

    return {

      success: false,

      error: 'Google sign-in is not configured yet. Contact your IT team.'

    }

  }



  const client = createOAuthClient(config)

  const existing = loadTokens()

  const authUrl = client.generateAuthUrl({

    access_type: 'offline',

    prompt: existing?.refresh_token ? undefined : 'consent',

    scope: GOOGLE_SCOPES

  })



  return new Promise((resolve) => {

    let server: Server | null = null

    let settled = false

    const redirect = new URL(config.googleRedirectUri)

    const port = Number(redirect.port || 42813)



    const finish = (result: { success: boolean; email?: string; error?: string }) => {

      if (settled) return

      settled = true

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

        contextIsolation: true

      }

    })



    const handleRedirect = async (targetUrl: string): Promise<void> => {

      if (!targetUrl.startsWith(config.googleRedirectUri)) {

        return

      }



      const requestUrl = new URL(targetUrl)

      const code = requestUrl.searchParams.get('code')

      const error = requestUrl.searchParams.get('error')



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



        saveTokens({

          access_token: tokens.access_token,

          refresh_token: tokens.refresh_token,

          expiry_date: tokens.expiry_date,

          email

        })



        finish({ success: true, email })

      } catch (authError) {

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

  })

}



export async function getAuthorizedClient(config: AppConfig) {

  const tokens = loadTokens()

  if (!tokens?.refresh_token) {

    throw new Error('Google account not connected. Click Connect first.')

  }



  const client = createOAuthClient(config)

  client.setCredentials(tokens)

  client.on('tokens', (freshTokens) => {

    saveTokens({ ...tokens, ...freshTokens })

  })



  return client

}


