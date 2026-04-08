/**
 * Rate limiter basique en mémoire pour les routes API.
 * Stocke les timestamps de requêtes par clé (IP + route).
 * Retourne true si la requête est autorisée, false si limitée.
 */

interface RateLimitEntry {
  timestamps: number[]
}

const store = new Map<string, RateLimitEntry>()

// Nettoyage périodique des entrées expirées (toutes les 5 min)
setInterval(() => {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export function checkRateLimit(key: string, maxRequests: number): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Filtrer les timestamps hors de la fenêtre
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)

  if (entry.timestamps.length >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  entry.timestamps.push(now)
  return { allowed: true, remaining: maxRequests - entry.timestamps.length }
}
