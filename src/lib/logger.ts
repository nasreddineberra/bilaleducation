/**
 * Utilitaire de logging structuré pour le serveur.
 * Ajoute un timestamp ISO, un niveau, et un contexte JSONifiable.
 * À utiliser dans les Server Actions et API Routes.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  [key: string]: unknown
}

function log(level: LogLevel, message: string, context?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  }

  // Ajout du contexte si présent et JSONifiable
  if (context !== undefined) {
    try {
      JSON.parse(JSON.stringify(context))
      Object.assign(entry, { context })
    } catch {
      Object.assign(entry, { contextError: 'Non-serializable context' })
    }
  }

  const output = JSON.stringify(entry)

  switch (level) {
    case 'error':
      console.error(output)
      break
    case 'warn':
      console.warn(output)
      break
    default:
      console.info(output)
      break
  }
}

export const logger = {
  info: (message: string, context?: unknown) => log('info', message, context),
  warn: (message: string, context?: unknown) => log('warn', message, context),
  error: (message: string, context?: unknown) => log('error', message, context),
}
