import { sendNotificationEmail } from '@/lib/email'
import { escapeHtml } from '@/lib/security/escape-html'

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

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; max-width:600px; color:#1f2e35;">
    <h2 style="margin:0 0 16px; font-size:18px;">Adresse de connexion modifiée</h2>

    <p style="margin:0 0 14px; font-size:14px; line-height:1.65;">
      L'adresse de connexion de votre compte n'est plus
      <strong>${escapeHtml(ancienneAdresse)}</strong>, mais
      <strong>${escapeHtml(nouvelleAdresse)}</strong>.
    </p>
    <p style="margin:0 0 14px; font-size:14px; line-height:1.65;">
      ${origine} Vous recevez ce message à votre ancienne adresse : c'est la
      dernière fois qu'elle est utilisée pour ce compte.
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:18px;">
      <tr>
        <td style="background-color:#fff8e6; border-radius:10px; padding:14px 16px; font-size:13px; line-height:1.6; color:#996100;">
          <strong>Vous n'êtes pas à l'origine de ce changement&nbsp;?</strong>
          Votre compte est peut-être compromis, et vous ne pouvez plus y accéder avec
          cette adresse. Prévenez <strong>sans attendre</strong> la direction de votre
          établissement, qui peut reprendre la main sur le compte.
        </td>
      </tr>
    </table>

    <p style="margin:18px 0 0; font-size:11px; color:#786d64;">
      Message automatique &middot; Bilal Education
    </p>
  </div>`

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
