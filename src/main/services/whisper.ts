import { spawn } from 'child_process'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AppConfig } from '../../shared/types'

export async function generateTranscript(
  config: AppConfig,
  wavPath: string,
  transcriptPath: string,
  onLog?: (line: string) => void
): Promise<string> {
  if (!config.whisperEnabled) {
    const placeholder = 'Transcript was not generated for this recording.'
    writeFileSync(transcriptPath, placeholder, 'utf8')
    return placeholder
  }

  if (!existsSync(wavPath)) {
    throw new Error(`Audio file not found for transcription: ${wavPath}`)
  }

  const modelPath = config.whisperModelPath
  if (!modelPath || !existsSync(modelPath)) {
    const placeholder = [
      'Transcript could not be generated on this computer.',
      'The transcription tools may be missing from the installation.',
      'Please reinstall CARE Meet Companion or contact your IT support team.'
    ].join('\n')
    writeFileSync(transcriptPath, placeholder, 'utf8')
    return placeholder
  }

  const outputPrefix = join(dirname(transcriptPath), 'transcript')
  const args = ['-m', modelPath, '-f', wavPath, '-otxt', '-of', outputPrefix, '-l', 'en']

  try {
    await runWhisper(config.whisperPath, args, onLog)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const fallback = [
      'Transcript could not be generated automatically.',
      'Your recording was saved successfully.',
      '',
      `Details for support: ${message}`
    ].join('\n')
    writeFileSync(transcriptPath, fallback, 'utf8')
    return fallback
  }

  if (existsSync(transcriptPath)) {
    return readFileSync(transcriptPath, 'utf8')
  }

  const sidecar = `${wavPath}.txt`
  if (existsSync(sidecar)) {
    renameSync(sidecar, transcriptPath)
    return readFileSync(transcriptPath, 'utf8')
  }

  const prefixed = `${outputPrefix}.txt`
  if (existsSync(prefixed)) {
    renameSync(prefixed, transcriptPath)
    return readFileSync(transcriptPath, 'utf8')
  }

  throw new Error('Transcript file was not created.')
}

function runWhisper(
  command: string,
  args: string[],
  onLog?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cwd = existsSync(command) ? dirname(command) : undefined
    const child = spawn(command, args, { windowsHide: true, cwd })
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => onLog?.(data.toString()))
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
      onLog?.(data.toString())
    })

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(
          new Error(
            'Transcription program not found. Reinstall CARE Meet Companion to repair transcription tools.'
          )
        )
        return
      }
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `Transcription exited with code ${code}`))
    })
  })
}
