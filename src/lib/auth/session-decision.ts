/**
 * LA DÉCISION DE SESSION, extraite du middleware pour pouvoir être ÉPROUVÉE.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────┐
 * │ Ce mécanisme a reçu SIX correctifs en un mois (12/07 double connexion,   │
 * │ 13/07 durée du traceur, 14/07 ajout d'`app-open`, 09/08 condition        │
 * │ retirée en urgence après un verrouillage, 11/08 deux écrivains pour un   │
 * │ même cookie, 11/08 garde « auth fraîche »). Les six ont été trouvés par  │
 * │ l'utilisateur, EN PRODUCTION, et deux l'ont verrouillé dehors.           │
 * │                                                                          │
 * │ Quatre d'entre eux vivaient dans la DÉCISION elle-même, et elle était    │
 * │ inéprouvable : mêlée au middleware, à `createServerClient`, à            │
 * │ `NextResponse` et à `signOut`. On ne pouvait pas répondre à « que se     │
 * │ passe-t-il après deux mois sans connexion ? » autrement qu'en attendant  │
 * │ deux mois.                                                               │
 * │                                                                          │
 * │ Elle est donc ici, PURE : trois entrées, aucune dépendance, aucun effet. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * EXTRACTION À L'IDENTIQUE. Ce code est la recopie mot pour mot de ce que
 * `proxy.ts` faisait, y compris ses deux bases de temps (`now` en secondes
 * ENTIÈRES pour l'inactivité, `ageSession` en flottant pour la durée maximale)
 * et la priorité du motif. Rien n'a été « amélioré » au passage : un test qui
 * fige un comportement qu'on vient de modifier ne prouve rien.
 *
 * LES SEUILS SONT DES PARAMÈTRES, et ce n'est pas de la décoration : c'est ce
 * qui permet d'éprouver « que se passerait-il si quelqu'un remettait le traceur
 * à 30 jours ? » — le défaut du 13 juillet — sans toucher à la production.
 */

/** `ok` = on laisse entrer · les deux autres sont le `?reason=` de `/login`. */
export type VerdictSession = 'ok' | 'inactivity' | 'session'

export interface SeuilsSession {
  /** Fenêtre d'inactivité, en secondes. */
  inactiviteSecondes: number
  /** Durée maximale d'une session depuis la connexion, en secondes. */
  dureeMaxSecondes: number
  /**
   * Durée de vie du cookie traceur, en secondes.
   *
   * Elle DOIT rester supérieure à la fenêtre d'inactivité : c'est elle qui
   * permet de trancher l'absence de traceur. Voir `traceurCouvreLaFenetre`.
   */
  traceurMaxAgeSecondes: number
}

export interface EntreesSession {
  /** `user.last_sign_in_at` de Supabase : la SEULE autorité sur l'âge réel. */
  lastSignInAt: string | null | undefined
  /** Valeur brute du cookie `app-session`, telle que le navigateur l'envoie. */
  traceur: string | undefined
  /** `Date.now()` à l'instant de la décision. */
  maintenantMs: number
}

export interface DecisionSession {
  verdict: VerdictSession
  inactive: boolean
  expired: boolean
  /** Âge de la session en secondes ; `0` quand Supabase ne le dit pas. */
  ageSessionSecondes: number
  /** Dernière activité lue dans le traceur, ou `null` s'il manque ou ment. */
  lastActivity: number | null
}

/**
 * Lit la dernière activité dans le cookie traceur.
 *
 * TOUT CE QUI N'EST PAS UN NOMBRE VAUT « ABSENT », jamais une erreur : un
 * cookie illisible, tronqué, posé par une version précédente ou appartenant à
 * un autre domaine ne doit pas pouvoir décider du sort de la session. C'est
 * précisément la confusion « périmé / étranger » qui a produit les
 * verrouillages sans recours — un traceur ne peut plus MENTIR, seulement
 * MANQUER, et son absence se tranche avec l'âge de la session.
 */
export function lireTraceur(valeur: string | undefined): number | null {
  if (!valeur) return null
  try {
    const parsed = JSON.parse(valeur)
    if (typeof parsed?.lastActivity === 'number') return parsed.lastActivity
  } catch {
    // Traceur illisible : on l'ignore. Le middleware le réécrira.
  }
  return null
}

/**
 * Faut-il laisser entrer, et sinon avec quel motif.
 *
 * FAIL-OPEN : dans le doute, on entre. Verrouiller un client dehors est plus
 * grave que de le garder connecté une nuit — c'est l'arbitrage du 11 août,
 * pris après deux verrouillages en production.
 */
export function evaluerSession(
  { lastSignInAt, traceur, maintenantMs }: EntreesSession,
  { inactiviteSecondes, dureeMaxSecondes, traceurMaxAgeSecondes }: SeuilsSession,
): DecisionSession {
  const now = Math.floor(maintenantMs / 1000)

  // ── Durée maximale : ancrée sur SUPABASE ──────────────────────────────────
  // Une date absente ou illisible donne un âge de 0, donc on entre : on ne
  // déconnecte jamais sur une information qu'on n'a pas.
  const signIn = lastSignInAt ? Date.parse(lastSignInAt) : NaN
  const ageSessionSecondes = Number.isFinite(signIn) ? (maintenantMs - signIn) / 1000 : 0
  const expired = ageSessionSecondes > dureeMaxSecondes

  // ── Inactivité : la seule chose que nous ayons à mesurer ──────────────────
  const lastActivity = lireTraceur(traceur)

  const inactive = lastActivity !== null
    // Traceur présent : il fait foi, c'est la mesure la plus précise.
    ? now - lastActivity > inactiviteSecondes
    // Traceur absent ET session plus vieille que la durée de vie du cookie : il
    // a donc expiré sans être rafraîchi, donc aucune activité depuis au moins
    // ce délai. Une session plus jeune, elle, vient forcément de commencer.
    : ageSessionSecondes > traceurMaxAgeSecondes

  // L'INACTIVITÉ PRIME QUAND LES DEUX SONT VRAIS. Comportement d'origine,
  // conservé tel quel par l'extraction. Il se remarque au RETOUR DE VACANCES :
  // après deux mois, les deux fenêtres sont franchies et l'écran annonce
  // « expirée pour inactivité », alors que la cause structurelle est la durée
  // maximale. Sans conséquence pour l'utilisateur — il se reconnecte — mais
  // c'est un choix, et ce test le grave : le changer est une décision, pas une
  // correction.
  const verdict: VerdictSession = inactive ? 'inactivity' : expired ? 'session' : 'ok'

  return { verdict, inactive, expired, ageSessionSecondes, lastActivity }
}

/**
 * L'INVARIANT QUI TIENT TOUT LE RESTE : le traceur doit vivre PLUS LONGTEMPS
 * que la fenêtre qu'il surveille.
 *
 * S'il vit moins, il disparaît alors que la session est encore valide, et la
 * branche « traceur absent » tranche à sa place sur un âge qui n'a rien à voir.
 * S'il vit beaucoup plus — 30 jours, la valeur du 13 juillet — son absence
 * n'est plus jamais concluante : la protection d'inactivité s'auto-désactive
 * EN SILENCE. C'est le défaut constaté ce jour-là, et aucun écran ne l'aurait
 * montré.
 */
export function traceurCouvreLaFenetre(s: SeuilsSession): boolean {
  return s.traceurMaxAgeSecondes > s.inactiviteSecondes
    && s.traceurMaxAgeSecondes < s.dureeMaxSecondes
}
