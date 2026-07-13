// Source unique des délais de session (utilisée par le middleware et le hook client).
export const INACTIVITY_SECONDS  = 60 * 60      // 1 heure d'inactivité
export const MAX_SESSION_SECONDS = 24 * 3600    // 24 heures max depuis la connexion
export const INACTIVITY_MS       = INACTIVITY_SECONDS * 1000

// Durée de vie du cookie tracker `app-session` : doit être BIEN plus longue que la
// fenêtre surveillée (inactivité 1h / max 24h). Sinon le cookie disparaît avant que
// l'expiration puisse être constatée, et son absence est prise pour une session neuve
// → l'inactivité/durée max ne s'appliquent plus (la session Supabase, elle, persiste).
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 3600   // 30 jours
