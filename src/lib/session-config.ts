// Source unique des délais de session (utilisée par le middleware et le hook client).
export const INACTIVITY_SECONDS  = 60 * 60      // 1 heure d'inactivité
export const MAX_SESSION_SECONDS = 24 * 3600    // 24 heures max depuis la connexion
export const INACTIVITY_MS       = INACTIVITY_SECONDS * 1000
