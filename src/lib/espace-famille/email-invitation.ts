import { coque, p, pDoux, bouton } from '@/lib/email/shell.mjs'
import { escapeHtml } from '@/lib/security/escape-html'

/**
 * EMAIL D'INVITATION A L'ESPACE FAMILLE : a la marque de l'ECOLE (elle invite,
 * son SMTP l'envoie). Le lien mene a « Activer mon acces » (valable 7 jours,
 * usage unique), puis au choix du mot de passe.
 */
export const VALIDITE_INVITATION_JOURS = 7

export function emailInvitation(o: {
  ecole: { nom: string; logoUrl: string | null }
  prenom: string | null
  nom: string | null
  lien: string
}): { sujet: string; html: string } {
  const ecole = escapeHtml(o.ecole.nom)
  const qui = [o.nom, o.prenom].filter(Boolean).join(' ').trim()
  const salut = qui ? `Bonjour ${escapeHtml(qui)},` : 'Bonjour,'
  const sujet = `${o.ecole.nom} · Votre espace famille`
  const html = coque({
    titre: 'Votre espace famille',
    apercu: `${o.ecole.nom} vous ouvre un accès en ligne au suivi de la scolarité.`,
    corps: [
      p(salut),
      p(`${ecole} vous ouvre un accès en ligne : emploi du temps, devoirs, absences, bulletins et règlements de votre foyer.`),
      p('Pour activer votre accès et choisir votre mot de passe, cliquez sur le bouton ci-dessous.'),
      bouton(o.lien, 'Activer mon accès'),
      pDoux(`Ce lien est valable ${VALIDITE_INVITATION_JOURS} jours et ne sert qu’une fois. Passé ce délai, demandez à l’établissement de vous renvoyer une invitation.`),
      pDoux(`Vos données sont traitées par ${ecole} pour le suivi de la scolarité. Pour toute question sur leur utilisation, adressez-vous à l’établissement.`),
    ].join('\n'),
    ecole: { nom: o.ecole.nom, logoUrl: o.ecole.logoUrl },
  })
  return { sujet, html }
}
