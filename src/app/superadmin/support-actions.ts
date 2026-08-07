'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { requireEditor } from '@/lib/auth/requireEditor'
import { ouvrirIntervention, fermerIntervention } from '@/lib/support/intervention'
import { updateTag } from 'next/cache'

/**
 * Accès support de l'éditeur : rattacher / détacher le super-admin d'une école.
 *
 * Le rattachement est l'INTERRUPTEUR de l'intervention. Rattaché,
 * `get_user_role()` répond `admin` et la RLS ouvre les données de cette école ;
 * détaché, `current_etablissement_id()` vaut NULL et plus rien ne correspond.
 * Son rôle en base ne change jamais.
 *
 * CLIENT SERVICE-ROLE OBLIGATOIRE, et ce n'est pas un raccourci : deux verrous
 * s'y opposent autrement. La policy `profiles_update` exige
 * `etablissement_id = current_etablissement_id()`, faux quand les deux valent
 * NULL ; et le déclencheur anti-escalade interdit de toucher à cette colonne
 * sauf en service-role ou pour un admin. Vérifié en base : par tout autre
 * chemin, y compris `psql`, la mise à jour est refusée.
 */

/**
 * Rattache le super-admin à une école pour intervenir dessus.
 *
 * REFUSE si un rattachement est déjà en cours ailleurs. Un profil ne porte
 * qu'un établissement : sans ce refus, ouvrir une seconde école déplacerait le
 * rattachement et le premier onglet se mettrait **silencieusement** à travailler
 * sur la mauvaise école — on croirait modifier A en modifiant B.
 */
export async function enterSchool(etablissementId: string): Promise<{ error?: string }> {
  const { userId, error: roleError } = await requireEditor()
  if (roleError || !userId) return { error: roleError }

  const session = await createClient()
  const admin = createAdminClient()

  // État réel, jamais le profil mis en cache : c'est lui qui décide du refus.
  const { data: me } = await admin
    .from('profiles')
    .select('etablissement_id')
    .eq('id', userId)
    .single()

  if (me?.etablissement_id && me.etablissement_id !== etablissementId) {
    return { error: 'Une intervention est déjà en cours sur une autre école. Quittez-la depuis la console avant d\'en ouvrir une autre.' }
  }
  if (me?.etablissement_id === etablissementId) return {}   // déjà en place

  const { data: ecole } = await admin
    .from('etablissements')
    .select('nom')
    .eq('id', etablissementId)
    .maybeSingle()
  if (!ecole) return { error: 'Établissement introuvable.' }

  const { error } = await admin
    .from('profiles')
    .update({ etablissement_id: etablissementId })
    .eq('id', userId)

  if (error) return { error: "Impossible d'ouvrir l'intervention." }

  // Journal de l'ÉDITEUR, distinct de celui de l'école : c'est lui qui permet de
  // voir ce qui est ouvert en ce moment, sans parcourir tous les clients.
  const { data: moi } = await admin.from('profiles').select('email').eq('id', userId).single()
  await ouvrirIntervention(userId, moi?.email ?? null, etablissementId)

  // Le profil est mis en cache une heure : sans invalidation, la sidebar et le
  // tableau de bord continueraient de travailler sur l'état d'avant.
  updateTag('profile')

  try {
    await logAudit(session, {
      action: 'UPDATE',
      entityType: 'support',
      entityId: etablissementId,
      description: `Ouverture d'une intervention de support sur ${ecole.nom}`,
    })
  } catch { /* la trace ne doit pas faire échouer l'intervention */ }

  return {}
}

/**
 * Met fin à l'intervention.
 *
 * Doit rester possible EN TOUTE CIRCONSTANCE : c'est la seule sortie. Une
 * session interrompue — onglet fermé, ordinateur éteint — laisse le
 * rattachement en place, et le refus d'en ouvrir une autre enfermerait l'éditeur
 * s'il n'y avait pas ce bouton. Il vit dans la console, qui reste accessible
 * pendant l'intervention : sa garde lit la COLONNE `profiles.role`, laquelle
 * vaut toujours `super_admin`.
 */
export async function leaveSchool(): Promise<{ error?: string }> {
  const { userId, error: roleError } = await requireEditor()
  if (roleError || !userId) return { error: roleError }

  const session = await createClient()
  const admin = createAdminClient()

  const { data: me } = await admin
    .from('profiles')
    .select('etablissement_id, etablissements:etablissement_id(nom)')
    .eq('id', userId)
    .single()

  if (!me?.etablissement_id) return {}   // rien en cours

  const nom = (me.etablissements as unknown as { nom: string } | null)?.nom ?? 'un établissement'

  // La trace s'écrit AVANT le détachement, et l'ordre n'est pas indifférent :
  // `logAudit` prend l'établissement dans le profil de l'appelant et abandonne
  // en silence quand il est nul. Écrite après, la fin d'intervention ne serait
  // jamais consignée — l'ouverture le serait, la fermeture pas, et le journal
  // laisserait croire à une intervention encore en cours.
  try {
    await logAudit(session, {
      action: 'UPDATE',
      entityType: 'support',
      entityId: me.etablissement_id,
      description: `Fin de l'intervention de support sur ${nom}`,
    })
  } catch { /* non bloquant */ }

  const { error } = await admin
    .from('profiles')
    .update({ etablissement_id: null })
    .eq('id', userId)

  if (error) return { error: "Impossible de fermer l'intervention." }

  await fermerIntervention(userId, 'manuelle')

  updateTag('profile')

  return {}
}
