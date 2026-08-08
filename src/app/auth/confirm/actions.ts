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

  redirect(next)
}
