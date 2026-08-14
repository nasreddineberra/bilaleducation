/**
 * Les refus de Supabase, dits en français.
 *
 * ┌─ POURQUOI ───────────────────────────────────────────────────────────────┐
 * │ `auth.updateUser()` renvoie ses messages en anglais, et l'écran de        │
 * │ réinitialisation les affichait TELS QUELS. Un utilisateur qui vient de    │
 * │ perdre son mot de passe lisait :                                          │
 * │                                                                           │
 * │   « AAL2 session is required to update email or password when MFA is      │
 * │     enabled »                                                             │
 * │                                                                           │
 * │ Ce n'est pas seulement une question de langue : la phrase ne dit pas quoi │
 * │ faire. Or ces écrans sont ceux d'une personne déjà en difficulté — c'est  │
 * │ le pire endroit pour laisser fuir un message technique.                   │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Le rapprochement se fait sur un FRAGMENT stable du message et non sur son
 * texte entier : Supabase reformule les siens sans prévenir, et un test
 * d'égalité stricte se romprait en silence — l'utilisateur reverrait alors
 * l'anglais, sans que rien ne signale la régression.
 *
 * Deuxième usage (fiche Mon compte et écran de réinitialisation), donc extrait.
 */

const TRADUCTIONS: { fragment: string; message: string }[] = [
  {
    // Le compte a une double authentification : le lien de récupération ouvre
    // une session de niveau AAL1, insuffisante pour toucher au mot de passe.
    // Ne devrait plus survenir — `/auth/confirm` intercale desormais le défi
    // TOTP — mais le message reste, au cas où un lien parti avant le correctif
    // aboutirait encore ici.
    fragment: 'AAL2',
    message:
      "Votre compte est protégé par une double authentification : ce lien seul ne suffit pas à changer le mot de passe. " +
      "Demandez un nouveau lien, un code vous sera demandé avant l'enregistrement.",
  },
  {
    fragment: 'should be different',
    message: "Le nouveau mot de passe doit être différent de l'ancien.",
  },
  {
    fragment: 'session missing',
    message:
      "Votre session a expiré avant l'enregistrement. Demandez un nouveau lien de réinitialisation.",
  },
  {
    fragment: 'same_password',
    message: "Le nouveau mot de passe doit être différent de l'ancien.",
  },
  {
    fragment: 'weak',
    message: "Ce mot de passe est trop courant. Choisissez-en un moins prévisible.",
  },
]

/**
 * Message affichable pour un refus de changement de mot de passe.
 *
 * Le repli est volontairement générique : afficher l'anglais d'origine
 * « au cas où » ferait revenir le défaut qu'on corrige.
 */
export function messageErreurMotDePasse(brut: string | null | undefined): string {
  const texte = brut ?? ''
  const trouve = TRADUCTIONS.find(t => texte.toLowerCase().includes(t.fragment.toLowerCase()))
  if (trouve) return trouve.message

  // Le message d'origine part au journal du navigateur : introuvable pour
  // l'utilisateur, disponible pour qui diagnostique.
  if (texte) console.error('[auth] refus non traduit :', texte)
  return "Le mot de passe n'a pas pu être modifié. Veuillez réessayer, ou demander un nouveau lien."
}
