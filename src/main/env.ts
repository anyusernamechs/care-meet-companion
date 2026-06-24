import { app } from 'electron'
import { copyFileSync, existsSync } from 'fs'
import { join } from 'path'
import dotenv from 'dotenv'

export function bootstrapEnv(): void {
  const userDataEnv = join(app.getPath('userData'), '.env')
  const bundledEnv = join(process.resourcesPath, '.env')
  const bundledExample = join(process.resourcesPath, '.env.example')

  if (app.isPackaged && !existsSync(userDataEnv)) {
    if (existsSync(bundledEnv)) {
      copyFileSync(bundledEnv, userDataEnv)
    } else if (existsSync(bundledExample)) {
      copyFileSync(bundledExample, userDataEnv)
    }
  }

  const candidates = [
    join(process.cwd(), '.env'),
    userDataEnv,
    join(process.resourcesPath, '.env'),
    join(app.getAppPath(), '.env')
  ]

  for (const path of candidates) {
    if (existsSync(path)) {
      dotenv.config({ path, override: false })
    }
  }
}
