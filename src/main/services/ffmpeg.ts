import { spawn } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import { dirname, join } from 'path'
import type { AppConfig } from '../../shared/types'

export function runCommand(
  command: string,
  args: string[],
  onLog?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      cwd: existsSync(command) ? dirname(command) : undefined
    })
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      onLog?.(data.toString())
    })

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      onLog?.(text)
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        const lines = stderr
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        const relevant = lines.filter(
          (line) =>
            !line.startsWith('ffmpeg version') &&
            !line.startsWith('built with') &&
            !line.startsWith('configuration:') &&
            !line.startsWith('lib') &&
            line !== 'Copyright (c) 2000-2024 the FFmpeg developers'
        )
        reject(new Error(relevant.slice(-4).join('\n') || `${command} exited with code ${code}`))
      }
    })
  })
}

export async function probeMediaFile(
  config: AppConfig,
  mediaPath: string
): Promise<{ hasVideo: boolean; hasAudio: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(config.ffmpegPath, ['-hide_banner', '-i', mediaPath], {
      windowsHide: true,
      cwd: existsSync(config.ffmpegPath) ? dirname(config.ffmpegPath) : undefined
    })
    let stderr = ''

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', () => resolve({ hasVideo: false, hasAudio: false }))
    child.on('close', () => {
      resolve({
        hasVideo: /Video:/i.test(stderr),
        hasAudio: /Audio:/i.test(stderr)
      })
    })
  })
}

export async function convertWebmToMp4(
  config: AppConfig,
  webmPath: string,
  mp4Path: string,
  onLog?: (line: string) => void
): Promise<void> {
  if (!existsSync(webmPath)) {
    throw new Error(`Recording file not found: ${webmPath}`)
  }

  const source = await probeMediaFile(config, webmPath)

  const args = [
    '-y',
    '-fflags',
    '+genpts+discardcorrupt',
    '-i',
    webmPath,
    '-map',
    '0:v:0?',
    '-map',
    '0:a:0?',
    '-vf',
    'setpts=PTS-STARTPTS,format=yuv420p,setsar=1',
    '-fps_mode',
    'vfr',
    '-pix_fmt',
    'yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-af',
    'aresample=async=1:first_pts=0',
    '-max_muxing_queue_size',
    '9999',
    '-movflags',
    '+faststart',
    mp4Path
  ]

  await runCommand(config.ffmpegPath, args, onLog)

  const output = await probeMediaFile(config, mp4Path)
  if (!output.hasAudio && source.hasAudio) {
    throw new Error(
      'Recording audio was lost while saving the video. Please try another short test recording.'
    )
  }

  if (!output.hasAudio) {
    // Some WebM files expose audio in a way probe misses — verify with a quick extract.
    const wavProbe = join(dirname(webmPath), '.audio-probe.wav')
    try {
      await extractAudioWav(config, webmPath, wavProbe)
      if (existsSync(wavProbe)) {
        throw new Error(
          'Meeting audio was recorded but could not be added to the MP4. Please contact IT support.'
        )
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('could not be added')) {
        throw error
      }
      // No audio in source — video-only recording is acceptable.
    } finally {
      try {
        if (existsSync(wavProbe)) {
          unlinkSync(wavProbe)
        }
      } catch {
        // ignore cleanup
      }
    }
  }
}

export async function extractAudioWav(
  config: AppConfig,
  sourcePath: string,
  wavPath: string,
  onLog?: (line: string) => void
): Promise<void> {
  await runCommand(
    config.ffmpegPath,
    [
      '-y',
      '-i',
      sourcePath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-af',
      'aresample=async=1:first_pts=0',
      wavPath
    ],
    onLog
  )
}

export function sessionPaths(sessionDir: string, videoTitle: string) {
  const videoBase = sanitizeFileName(videoTitle)
  return {
    webm: join(sessionDir, '.temp-recording.webm'),
    mp4: join(sessionDir, `${videoBase}.mp4`),
    wav: join(sessionDir, '.temp-audio.wav'),
    transcript: join(sessionDir, 'transcript.txt')
  }
}

function sanitizeFileName(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'Meeting'
  )
}
