/**
 * Vérification CSRF basique pour les routes API.
 * Vérifie que les headers Origin/Referer correspondent au domaine attendu.
 * Retourne true si la requête est légitime, false sinon.
 */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL ?? '',
  `http://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')}`,
].filter(Boolean)

function isSameOrigin(requestOrigin: string | null, referer: string | null): boolean {
  const origins = new Set(ALLOWED_ORIGINS)

  // Vérifier Origin en premier (plus fiable)
  if (requestOrigin) {
    if (origins.has(requestOrigin)) return true
    // Vérifier aussi sans le path
    try {
      const url = new URL(requestOrigin)
      if (origins.some(o => o.includes(url.host))) return true
    } catch {
      // Ignorer les URLs malformées
    }
  }

  // Fallback sur Referer
  if (referer) {
    try {
      const url = new URL(referer)
      if (origins.some(o => o.includes(url.host))) return true
    } catch {
      // Ignorer
    }
  }

  return origins.size === 0 // Si aucune origine configurée, on laisse passer (dev)
}

export function checkCsrf(req: Request): { valid: boolean } {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')

  // En dev local, on laisse passer (pas d'origin sur les requêtes internes)
  if (process.env.NODE_ENV !== 'production') {
    return { valid: true }
  }

  // Requêtes internes (depuis le serveur Next.js) n'ont pas d'origin
  if (!origin && !referer) {
    return { valid: true }
  }

  if (isSameOrigin(origin, referer)) {
    return { valid: true }
  }

  return { valid: false }
}
