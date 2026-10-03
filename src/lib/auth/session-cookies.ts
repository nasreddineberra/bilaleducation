/**
 * LES COOKIES TRACEURS DE SESSION : leur nom, et leur purge.
 *
 * ┌─ POURQUOI UN MODULE POUR SI PEU ─────────────────────────────────────────┐
 * │ Le 11 août, la production s'est verrouillée parce que DEUX endroits      │
 * │ posaient `app-session` : la page de connexion (sans domaine, sans        │
 * │ HttpOnly, 24 h) et le middleware (avec domaine, HttpOnly, 30 jours). Le  │
 * │ navigateur en gardait deux, et `request.cookies.get()` rendait celui que │
 * │ l'en-tête présentait en premier — souvent le périmé. Le middleware       │
 * │ concluait à l'inactivité et renvoyait vers `/login`. À chaque tentative. │
 * │                                                                          │
 * │ RÈGLE NÉE CE JOUR-LÀ : un cookie n'a qu'UN écrivain. Ce module en est la │
 * │ forme — le nom est déclaré ici, une seule fois, et un test structurel    │
 * │ (`session-cookies.test.ts`) refuse qu'il réapparaisse ailleurs.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Le traceur d'activité. Il ne porte que `lastActivity`, vit 1 h 20, et il est
 * CONSULTATIF : il ne peut plus mentir, seulement manquer. Son absence se
 * tranche avec `last_sign_in_at`, qui vient de Supabase.
 */
export const COOKIE_SESSION = 'app-session'

/**
 * Ancien marqueur de session navigateur, RETIRÉ le 11 août.
 *
 * Il servait à distinguer « navigateur resté ouvert » de « rouvert », pour
 * choisir le libellé d'un message. Troisième état à tenir cohérent avec les
 * deux autres, il a verrouillé la production le 9 août — un message n'a jamais
 * valu ce risque, et le motif se déduit désormais de ce qu'on mesure.
 *
 * Le nom ne survit que pour une raison : PURGER les navigateurs qui en portent
 * encore un. À supprimer quand le parc aura tourné.
 */
export const COOKIE_MARQUEUR_RETIRE = 'app-open'

/** Les deux noms qu'une déconnexion doit effacer. */
export const COOKIES_A_PURGER = [COOKIE_SESSION, COOKIE_MARQUEUR_RETIRE] as const

/**
 * Les en-têtes `Set-Cookie` qui effacent les traceurs, AVEC domaine ET SANS.
 *
 * ┌─ POURQUOI DEUX FOIS ─────────────────────────────────────────────────────┐
 * │ `sessionCookieDomain()` dérive son domaine de `NEXT_PUBLIC_SITE_URL`,    │
 * │ qui n'a pas toujours existé : avant qu'elle soit posée, les cookies      │
 * │ étaient attachés à l'HÔTE SEUL. Un navigateur ayant traversé ce          │
 * │ changement en détient donc DEUX — un ancien sans domaine, un récent sur  │
 * │ `.bilaleducation.fr`.                                                    │
 * │                                                                          │
 * │ Une purge portant un domaine n'atteint QUE le second. L'ancien survivait │
 * │ avec son horodatage périmé, le middleware le lisait à chaque passage,    │
 * │ concluait à l'inactivité, et renvoyait vers `/login` : BOUCLE            │
 * │ PERMANENTE sur ce navigateur, constatée en production le 11 août et      │
 * │ résolue en vidant les cookies à la main. Une purge doit atteindre les    │
 * │ deux, sinon elle ne prouve rien.                                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `Path=/` et `Max-Age=0` sont les deux attributs qui FONT l'effacement : un
 * navigateur n'apparie un `Set-Cookie` à un cookie existant que sur le triplet
 * (nom, domaine, chemin). Un `Path` différent ne supprimerait rien — il
 * poserait un second cookie vide, et laisserait l'ancien en place.
 *
 * L'appelant émet ces en-têtes avec `headers.append` et JAMAIS `cookies.set` :
 * le magasin de `NextResponse` est indexé PAR NOM, donc poser deux fois le même
 * nom remplacerait le premier au lieu d'émettre deux en-têtes. Le navigateur,
 * lui, distingue bien deux cookies de même nom si leur domaine diffère — c'est
 * toute l'origine du problème.
 */
export function entetesDePurge(domaine?: string): string[] {
  const entetes: string[] = []
  for (const nom of COOKIES_A_PURGER) {
    entetes.push(`${nom}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`)
    if (domaine) {
      entetes.push(`${nom}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Domain=${domaine}`)
    }
  }
  return entetes
}

/**
 * LES CHEMINS QUI DOIVENT EFFACER LES TRACEURS.
 *
 * ┌─ POURQUOI UNE LISTE, ET POURQUOI DEUX ENTREES ───────────────────────────┐
 * │ Un traceur est `httpOnly` : le navigateur ne peut PAS l effacer. Quand    │
 * │ l utilisateur clique « Deconnexion », le client appelle `signOut()` et    │
 * │ s en va — mais `app-session` reste, avec un `lastActivity` perime. Seul   │
 * │ le serveur peut le supprimer, et il ne le fait qu aux chemins listes ici. │
 * │                                                                           │
 * │ `/login` y est depuis le 12 juillet : sans lui, la premiere reconnexion   │
 * │ reussie etait aussitot re-deconnectee (« double login »).                 │
 * │                                                                           │
 * │ `/superadmin/login` MANQUAIT. La condition etait `pathname === '/login'`, │
 * │ une egalite stricte. Or le cookie porte le domaine entier                 │
 * │ (`.bilaleducation.fr`), donc il est PARTAGE entre la console et les       │
 * │ ecoles : un editeur qui quittait la console gardait un horodatage perime, │
 * │ et s il entrait ensuite dans une ecole, le controle d inactivite le       │
 * │ deconnectait aussitot. Meme montage que le defaut du 12 juillet, sur      │
 * │ l autre domaine — piste notee le 10 aout, jamais verifiee jusqu ici.      │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export const CHEMINS_DE_PURGE = ['/login', '/superadmin/login'] as const

/**
 * EGALITE STRICTE, jamais `startsWith` : ce dernier accepterait
 * `/loginbidon` ou `/login-autre-chose`, donc n importe quelle route future
 * commencant par ces lettres purgerait la session sans qu on l ait voulu.
 */
export function doitPurger(pathname: string): boolean {
  return (CHEMINS_DE_PURGE as readonly string[]).includes(pathname)
}
