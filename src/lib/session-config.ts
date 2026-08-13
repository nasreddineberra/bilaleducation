// Source unique des délais de session (utilisée par le middleware et le hook client).
export const INACTIVITY_SECONDS  = 60 * 60      // 1 heure d'inactivité
export const MAX_SESSION_SECONDS = 24 * 3600    // 24 heures max depuis la connexion
export const INACTIVITY_MS       = INACTIVITY_SECONDS * 1000

/**
 * Durée de vie du traceur `app-session`, BORNÉE à la fenêtre qu'il surveille.
 *
 * ┌─ POURQUOI ELLE A ÉTÉ RAMENÉE DE 30 JOURS À 2 HEURES ────────────────────┐
 * │ Le raisonnement d'origine — « le cookie doit survivre à la fenêtre pour  │
 * │ pouvoir CONSTATER l'expiration au retour » — supposait que le cookie soit│
 * │ toujours le nôtre et toujours à jour. En pratique il peut être celui d'un│
 * │ autre domaine, d'une configuration précédente, ou restauré par le        │
 * │ navigateur. Un cookie périmé et un cookie ÉTRANGER sont alors            │
 * │ indistinguables, et la règle « périmé ⇒ déconnexion » verrouillait       │
 * │ l'utilisateur dehors sans recours : chaque tentative repartait du même   │
 * │ état. Six correctifs en un mois sur ce seul mécanisme.                   │
 * │                                                                          │
 * │ Borné à 2 h, il ne peut plus MENTIR : il peut seulement MANQUER. Et son  │
 * │ absence se tranche avec `last_sign_in_at`, qui vient de Supabase et ne   │
 * │ peut pas diverger de la session qu'il décrit.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Marge d'une heure au-dessus de la fenêtre d'inactivité : elle absorbe les
 * décalages d'horloge sans rouvrir la porte à un cookie ancien.
 */
export const SESSION_COOKIE_MAX_AGE = INACTIVITY_SECONDS + 3600   // 2 heures

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
