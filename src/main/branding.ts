import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

export function getBrandingPath(fileName: string): string {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'branding', fileName)]
    : [
        join(app.getAppPath(), 'resources', 'branding', fileName),
        join(process.cwd(), 'resources', 'branding', fileName),
        join(__dirname, '../../resources/branding', fileName)
      ]

  return candidates.find((path) => existsSync(path)) || candidates[0]
}

export function getAppIconPath(): string {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'branding', 'logo.ico'),
        join(process.resourcesPath, 'icon.ico')
      ]
    : [
        join(process.cwd(), 'build', 'icon.ico'),
        join(app.getAppPath(), 'build', 'icon.ico'),
        join(app.getAppPath(), 'resources', 'branding', 'logo.ico'),
        join(process.cwd(), 'resources', 'branding', 'logo.ico')
      ]

  return candidates.find((path) => existsSync(path)) || candidates[candidates.length - 1]
}
