// Source unique des délais de session (utilisée par le middleware et le hook client).
export const INACTIVITY_SECONDS  = 60 * 60      // 1 heure d'inactivité
export const MAX_SESSION_SECONDS = 24 * 3600    // 24 heures max depuis la connexion
export const INACTIVITY_MS       = INACTIVITY_SECONDS * 1000

// Durée de vie du cookie tracker `app-session` : doit être BIEN plus longue que la
// fenêtre surveillée (inactivité 1h / max 24h). Sinon le cookie disparaît avant que
// l'expiration puisse être constatée, et son absence est prise pour une session neuve
// → l'inactivité/durée max ne s'appliquent plus (la session Supabase, elle, persiste).
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 3600   // 30 jours

/**
 * Domaine des cookies de session, ou `undefined` pour les laisser liés à l'hôte.
 *
 * POURQUOI. Un cookie sans domaine explicite ne vaut que pour l'hôte exact qui
 * l'a posé. La session de `superadmin.bilaleducation.fr` serait donc inconnue de
 * `bilal-neuville.bilaleducation.fr` : entrer dans une école depuis la console
 * déconnecterait. En posant `.bilaleducation.fr`, la session vaut pour le domaine
 * et tous ses sous-domaines.
 *
 * CONSÉQUENCE À CONNAÎTRE. Une session devient commune à TOUTES les écoles. Ce
 * n'est pas un trou de cloisonnement — les droits viennent de la RLS et du profil,
 * pas du cookie — mais un utilisateur d'une école qui taperait l'adresse d'une
 * autre y arriverait authentifié. Le middleware l'en empêche : il compare
 * l'établissement du jeton au sous-domaine et déconnecte en cas de discordance.
 * Ces deux mesures se tiennent ; retirer l'une casse l'autre.
 *
 * EN LOCAL, renvoie `undefined` : un domaine posé sur `localhost` est rejeté par
 * les navigateurs, et rien ne fonctionnerait plus.
 */
export function sessionCookieDomain(): string | undefined {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (!site) return undefined
  try {
    const host = new URL(site).hostname
    if (host === 'localhost' || host === '127.0.0.1') return undefined
    return `.${host}`
  } catch {
    return undefined
  }
}
