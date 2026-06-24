type LogLevel = 'info' | 'warn' | 'error'

function write(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  const prefix = `[care:${scope}]`
  if (level === 'error') {
    console.error(prefix, message, detail ?? '')
    return
  }
  if (level === 'warn') {
    console.warn(prefix, message, detail ?? '')
    return
  }
  console.log(prefix, message, detail ?? '')
}

export const log = {
  info: (scope: string, message: string, detail?: unknown) => write('info', scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) => write('warn', scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) => write('error', scope, message, detail)
}
