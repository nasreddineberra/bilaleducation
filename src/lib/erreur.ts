/**
 * Message d'une erreur levee dans un `catch` : une `Error`, ou une erreur
 * PostgREST (`{ message, details, code }`), qui n'est PAS une `Error` —
 * `e instanceof Error` perdrait son message.
 */
export function messageErreur(e: unknown): string | undefined {
  const message = (e as { message?: unknown } | null)?.message
  return typeof message === 'string' && message ? message : undefined
}
