import { sendNotificationEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/security/escape-html'
import { coque, p, alerte, C } from '@/lib/email/shell.mjs'

/**
 * Prévient l'ANCIENNE adresse qu'elle ne donne plus accès au compte.
 *
 * ┌─ POURQUOI C'EST LE CONTRÔLE QUI COMPTE ─────────────────────────────────┐
 * │ Quelqu'un qui prend la main sur une session ouverte change l'adresse pour │
 * │ verrouiller le compte à son profit. Après le changement, le titulaire     │
 * │ légitime ne reçoit plus rien à la nouvelle adresse — qu'il ne connaît pas │
 * │ — et n'a AUCUN moyen de s'apercevoir de quoi que ce soit.                │
 * │                                                                          │
 * │ L'ancienne boîte est le seul canal que l'attaquant ne contrôle pas. C'est │
 * │ la dernière occasion d'alerter, et elle ne se représente pas.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * POURQUOI NOUS L'ENVOYONS NOUS-MÊMES. Supabase propose une notification
 * « Email address changed », activée le 8 août — mais **elle n'est pas partie**
 * (vérifié sur un changement réel le 9 août). Le changement direct
 * (`email_confirm: true`) court-circuite le cycle de confirmation, et avec lui
 * l'alerte. Nous ne dépendons donc pas d'un comportement que nous ne maîtrisons
 * pas pour un contrôle de sécurité.
 *
 * NON BLOQUANT : le changement d'adresse a déjà eu lieu quand cette fonction
 * est appelée. Un échec d'envoi ne doit pas le défaire — il est signalé à
 * l'appelant, qui peut le dire à l'écran.
 */
export async function alerterAncienneAdresse(params: {
  etablissementId: string
  ancienneAdresse: string
  nouvelleAdresse: string
  /** Qui a fait le changement : le titulaire lui-même, ou un administrateur. */
  parUnAdministrateur: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const { etablissementId, ancienneAdresse, nouvelleAdresse, parUnAdministrateur } = params

  if (!ancienneAdresse || ancienneAdresse === nouvelleAdresse) return { ok: true }

  const origine = parUnAdministrateur
    ? "Ce changement a été effectué par un administrateur de votre établissement."
    : "Ce changement a été effectué depuis votre espace « Mon compte »."

  // Coque PARTAGÉE avec les gabarits d'authentification : même bandeau, même
  // carte, même pied. Un email de sécurité qui ne ressemble pas aux autres
  // messages du service ressemble à une tentative d'hameçonnage.
  const html = coque({
    titre: 'Adresse de connexion modifiée',
    apercu: "L'adresse de connexion de votre compte vient d'être modifiée.",
    corps: [
      p(`L'adresse de connexion de votre compte n'est plus <strong style="color:${C.encre};">${escapeHtml(ancienneAdresse)}</strong>, mais <strong style="color:${C.encre};">${escapeHtml(nouvelleAdresse)}</strong>.`),
      p(`${origine} Vous recevez ce message à votre ancienne adresse&nbsp;: c'est la dernière fois qu'elle est utilisée pour ce compte.`),
      alerte("<strong>Vous n'êtes pas à l'origine de ce changement&nbsp;?</strong> Votre compte est peut-être compromis, et vous ne pouvez plus y accéder avec cette adresse. Prévenez <strong>sans attendre</strong> la direction de votre établissement, qui peut reprendre la main sur le compte."),
    ].join('\n'),
  })

  const envoi = await sendNotificationEmail({
    etablissementId,
    to: [ancienneAdresse],
    subject: "Sécurité : l'adresse de connexion de votre compte a été modifiée",
    html,
  })

  if (!envoi.success) {
    console.error('[securite] alerte de changement d\'adresse non partie:', envoi.error)
  }
  return { ok: envoi.success, error: envoi.error }
}
