'use server'

import { randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { requestOrigin } from '@/lib/tenant/request-origin'
import { sendNotificationEmail } from '@/lib/email'
import { marqueEcole } from '@/lib/email/marque-ecole'
import { logAudit } from '@/lib/audit'
import { nouveauJeton } from '@/lib/espace-famille/jeton'
import { emailInvitation } from '@/lib/espace-famille/email-invitation'
import type { NumeroTuteur } from '@/lib/parents/participant'

/**
 * INVITER UN TUTEUR A L'ESPACE FAMILLE (decisions 12 a 16, docs/ESPACE-FAMILLE.md).
 *
 * 1. Compte d'authentification cree s'il n'existe pas (API admin : role `parent`,
 *    mot de passe aleatoire jamais transmis, email confirme).
 * 2. `preparer_invitation_tuteur` (client SESSION : gardes de role et d'ecole,
 *    option active, audit) : profil, lien au tuteur, date, jeton de 7 jours.
 * 3. Email par le SMTP de l'ecole, a sa marque : « Activer mon acces ».
 *
 * Un echec de l'email laisse l'invitation preparee : « Renvoyer l'invitation »
 * la remplace. Un echec AVANT l'email defait le compte cree a l'etape 1.
 */
export async function inviterTuteur(
  parentId: string,
  tutorNumber: NumeroTuteur,
): Promise<{ error?: string; email?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }

  const etablissementId = (await headers()).get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const session = await createClient()
  const admin = createAdminClient()

  const { data: foyer } = await session
    .from('parents')
    .select('id, tutor1_email, tutor2_email, tutor1_user_id, tutor2_user_id')
    .eq('id', parentId)
    .maybeSingle()
  if (!foyer) return { error: 'Foyer introuvable.' }

  const email = (tutorNumber === 1 ? foyer.tutor1_email : foyer.tutor2_email)?.trim().toLowerCase()
  if (!email) return { error: 'Ce tuteur n’a pas d’adresse email.' }
  let compte = tutorNumber === 1 ? foyer.tutor1_user_id : foyer.tutor2_user_id

  // 1. Compte d'authentification (premier envoi seulement).
  let cree = false
  if (!compte) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: randomBytes(32).toString('base64url'),
      email_confirm: true,
      // Miroir de `profiles` dans le jeton (middleware) : voir `createUser`.
      app_metadata: { role: 'parent', etablissement_id: etablissementId },
    })
    if (error || !data.user) {
      if (error?.message.includes('already registered')) {
        return { error: `L’adresse ${email} est déjà utilisée par un autre compte.` }
      }
      return { error: error?.message ?? 'Le compte n’a pas pu être créé.' }
    }
    compte = data.user.id
    cree = true
  }

  // 2. Invitation (la base juge : role, ecole, option, email, compte).
  const { jeton, empreinte } = nouveauJeton()
  const { data: tuteur, error: rpcError } = await session.rpc('preparer_invitation_tuteur', {
    p_parent_id: parentId,
    p_tutor_number: tutorNumber,
    p_profile_id: compte,
    p_empreinte: empreinte,
  })
  if (rpcError) {
    if (cree) {
      const { error: errSuppr } = await admin.auth.admin.deleteUser(compte)
      if (errSuppr) console.error('[inviterTuteur] compte cree non supprime :', errSuppr.message)
    }
    return { error: rpcError.message }
  }
  const t = tuteur as { email: string; nom: string | null; prenom: string | null }

  // 3. Email a la marque de l'ecole ; reponse a son contact.
  const [ecole, { data: etab }] = await Promise.all([
    marqueEcole(admin, etablissementId),
    admin.from('etablissements').select('contact').eq('id', etablissementId).maybeSingle(),
  ])
  const lien = `${await requestOrigin()}/auth/activer-acces?jeton=${jeton}`
  const { sujet, html } = emailInvitation({ ecole, prenom: t.prenom, nom: t.nom, lien })
  const envoi = await sendNotificationEmail({
    etablissementId,
    to: [t.email],
    subject: sujet,
    html,
    replyTo: etab?.contact?.trim() || undefined,
  })

  await logAudit(session, {
    action: 'UPDATE',
    entityType: 'parents',
    entityId: parentId,
    description: envoi.success
      ? `Invitation à l’espace famille envoyée à ${t.email} (tuteur ${tutorNumber})`
      : `Invitation à l’espace famille préparée pour ${t.email} (tuteur ${tutorNumber}), email non parti`,
  }).catch(() => { /* non bloquant */ })

  revalidatePath('/dashboard/utilisateurs')
  revalidatePath('/dashboard/parents')
  if (!envoi.success) {
    return { error: `L’invitation est prête mais l’email n’a pas pu partir : ${envoi.error ?? 'erreur inconnue'}.` }
  }
  return { email: t.email }
}
