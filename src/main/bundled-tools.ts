import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

function binRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin')
  }

  const candidates = [
    join(app.getAppPath(), 'resources', 'bin'),
    join(process.cwd(), 'resources', 'bin'),
    join(__dirname, '../../resources/bin')
  ]

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'ffmpeg', 'ffmpeg.exe'))) {
      return candidate
    }
  }

  return candidates[0]
}

function bundledPath(...parts: string[]): string {
  return join(binRoot(), ...parts)
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((path) => existsSync(path))
}

function resolveToolOverride(
  envOverride: string | undefined,
  resolveBundled: () => string
): string {
  const raw = envOverride?.trim()
  if (!raw) {
    return resolveBundled()
  }
  // Bare command names mean "auto" — prefer the installer bundle for staff machines.
  if (/^(ffmpeg|whisper|whisper-cli)$/i.test(raw)) {
    return resolveBundled()
  }
  return raw
}

export function resolveFfmpegPath(envOverride?: string): string {
  return resolveToolOverride(envOverride, () => {
    const bundled = bundledPath('ffmpeg', 'ffmpeg.exe')
    if (existsSync(bundled)) {
      return bundled
    }
    return 'ffmpeg'
  })
}

export function resolveWhisperExecutable(envOverride?: string): string {
  return resolveToolOverride(envOverride, () => {
    const bundled = firstExisting([
      bundledPath('whisper', 'whisper-cli.exe'),
      bundledPath('whisper', 'main.exe'),
      bundledPath('whisper', 'whisper.exe')
    ])

    if (bundled) {
      return bundled
    }

    return 'whisper-cli'
  })
}

export function resolveWhisperModelPath(envOverride?: string): string | undefined {
  if (envOverride?.trim()) {
    return envOverride.trim()
  }

  return firstExisting([
    bundledPath('whisper', 'models', 'ggml-base.en.bin'),
    bundledPath('whisper', 'models', 'ggml-base.bin'),
    bundledPath('whisper', 'ggml-base.en.bin')
  ])
}

export function hasBundledTranscriptionTools(): boolean {
  const ffmpeg = bundledPath('ffmpeg', 'ffmpeg.exe')
  const whisper = resolveWhisperExecutable()
  const model = resolveWhisperModelPath()
  return existsSync(ffmpeg) && existsSync(whisper) && Boolean(model && existsSync(model))
}
