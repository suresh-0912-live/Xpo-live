// Minimal structured console logger. Secrets (API keys) are never logged:
// URLs are masked before printing.

const SECRET_PATTERNS = [
  [/([?&](?:apiKey|api_key|token|secret|password)=)[^&\s]+/gi, '$1***'],
  [/("(?:password|apiKey|api_key|token|secret)"\s*:\s*")[^"]+"/gi, '$1***"'],
]

export function maskSecrets(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value)
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement)
  }
  return text
}

export function log(level, message, meta) {
  // Tests intentionally exercise error paths (401/403/404/503) — keep the
  // runner output clean. DEBUG_500=1 re-enables logging to hunt flakes.
  if (process.env.NODE_ENV === 'test' && !process.env.DEBUG_500) return

  const entry = {
    time: new Date().toISOString(),
    level,
    message: maskSecrets(message),
  }
  if (meta !== undefined) entry.meta = maskSecrets(meta)

  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
}

export default logger
