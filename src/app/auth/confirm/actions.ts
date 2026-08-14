'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Vérifie le jeton d'un lien d'authentification — SUR ACTION DE L'UTILISATEUR.
 *
 * ┌─ POURQUOI CE N'EST PAS FAIT À L'OUVERTURE DU LIEN ──────────────────────┐
 * │ Les messageries d'entreprise inspectent les liens entrants en les       │
 * │ OUVRANT. Microsoft Defender Safe Links, constaté le 9 août sur une vraie │
 * │ boîte (`emea01.safelinks.protection.outlook.com`), réécrit chaque URL et │
 * │ la visite avant le destinataire. Un jeton à usage unique est alors       │
 * │ consommé par l'inspecteur, et l'utilisateur reçoit « ce lien a déjà      │
 * │ servi » sur un message qui vient d'arriver.                             │
 * │                                                                          │
 * │ Un inspecteur SUIT les liens ; il ne soumet pas de formulaire. Vérifier  │
 * │ sur POST, déclenché par un vrai clic, le met hors jeu — c'est la parade  │
 * │ standard, et elle coûte un clic.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Types acceptés : `type` vient de l'URL et part vers l'API de Supabase. */
const TYPES = ['recovery', 'email', 'invite', 'magiclink', 'email_change'] as const
type TypeOtp = (typeof TYPES)[number]

export async function confirmerLien(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '')
  const type      = String(formData.get('type') ?? '')

  // Même garde que dans `/auth/callback` : un chemin absolu simple, sinon
  // `//ailleurs.example` ferait de cette page un tremplin vers un autre site.
  const nextBrut = String(formData.get('next') ?? '/dashboard')
  const next = /^\/(?!\/)/.test(nextBrut) ? nextBrut : '/dashboard'

  if (!tokenHash || !TYPES.includes(type as TypeOtp)) {
    redirect('/auth/reset-password?motif=sans-jeton')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    type: type as TypeOtp,
    token_hash: tokenHash,
  })

  if (error) {
    console.error('[auth/confirm] vérification refusée:', error.message)
    redirect('/auth/reset-password?motif=consomme')
  }

  // ── LE JETON NE VAUT PAS LA DOUBLE AUTHENTIFICATION ───────────────────────
  //
  // `verifyOtp` ouvre une session de niveau AAL1 (« quelqu'un a reçu l'email »).
  // Supabase EXIGE AAL2 — mot de passe reconnu ET code TOTP — pour changer un
  // mot de passe ou un email. Sans ce passage, l'écran suivant s'ouvrait
  // normalement puis refusait l'enregistrement, en anglais :
  //
  //   « AAL2 session is required to update email or password when MFA is enabled »
  //
  // Et le refus est JUSTE : sans lui, qui intercepte un lien de récupération
  // reprendrait un compte sans jamais voir son second facteur, ce qui viderait
  // la 2FA de son sens. Le lien prouve l'accès à la boîte mail, rien de plus.
  //
  // On intercale donc le défi, et l'écran de mot de passe s'ouvre APRÈS.
  //
  // L'autorité est `listFactors()`, qui interroge le SERVEUR. Le raccourci
  // `getAuthenticatorAssuranceLevel()` aurait été plus court, mais il déduit son
  // `nextLevel` des facteurs portés par la session locale : s'ils n'y figurent
  // pas — ce qui est possible sur une session tout juste ouverte par `verifyOtp` —
  // il répondrait `aal1`, on ne redirigerait pas, et le défaut resterait EN
  // SILENCE. Un aller-retour de plus vaut mieux qu'un correctif qui n'agit pas.
  //
  // Un compte sans facteur vérifié passe droit : il n'a pas de 2FA à opposer.
  const { data: facteurs } = await supabase.auth.mfa.listFactors()
  const doitPasserLeDefi = (facteurs?.all ?? [])
    .some(f => f.factor_type === 'totp' && f.status === 'verified')

  if (doitPasserLeDefi) {
    redirect(`/auth/totp-challenge?next=${encodeURIComponent(next)}`)
  }

  redirect(next)
}
