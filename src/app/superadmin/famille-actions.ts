'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireEditor } from '@/lib/auth/requireEditor'
import { refuserSiEffacee } from '@/lib/tenant/effacement'
import { tracerConsole } from '@/lib/support/actions-editeur'
import { optionActivable, RAISON_ECOLE_OUVERTE, RAISON_VERROU } from '@/lib/espace-famille/disponibilite'
import { fmtEuro } from '@/lib/financements/libelles'

/**
 * CONSOLE : OPTION ESPACE FAMILLE d'une ecole (decisions 17 a 20,
 * docs/ESPACE-FAMILLE.md). L'option est l'abonnement : elle se facture (relevé
 * mensuel), meme pendant une coupure decidee par l'ecole.
 *   - activer : verrou de developpement (demonstration seule tant qu'il est
 *     ferme) ; le mois en cours est du (decision 9) : son releve passe a l'option ;
 *   - desactiver : refuse tant que l'ECOLE a ouvert l'espace (la base le refuse
 *     aussi) ; le mois commence reste du.
 */

const moisEnCours = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' })
  .format(new Date()) + '-01'

export async function basculerOptionFamille(etablissementId: string, actif: boolean): Promise<{ error?: string }> {
  const { error: garde } = await requireEditor()
  if (garde) return { error: garde }
  const effacee = await refuserSiEffacee(etablissementId)
  if (effacee) return { error: effacee }

  const admin = createAdminClient()
  const { data: ecole } = await admin.from('etablissements')
    .select('est_demo, espace_famille_ouvert').eq('id', etablissementId).maybeSingle()
  if (!ecole) return { error: 'École introuvable.' }
  if (actif && !optionActivable(ecole.est_demo)) return { error: RAISON_VERROU }
  if (!actif && ecole.espace_famille_ouvert) return { error: RAISON_ECOLE_OUVERTE }

  const { error } = await admin.from('etablissements')
    .update({ option_espace_famille: actif }).eq('id', etablissementId).select('id')
  if (error) {
    console.error('[option famille]', error.message)
    return { error: error.code === '23514' ? RAISON_ECOLE_OUVERTE : 'L’option n’a pas pu être modifiée.' }
  }

  // Mois commence = du (decision 9) : le releve deja pris ce mois-ci passe a l'option.
  if (actif) {
    const { data: tarif } = await admin.from('etablissement_facturation')
      .select('famille_forfait, famille_prix_inscrit').eq('etablissement_id', etablissementId).maybeSingle()
    const { error: eReleve } = await admin.from('releves_facturation')
      .update({ option_espace_famille: true, famille_forfait: tarif?.famille_forfait ?? null, famille_prix_inscrit: tarif?.famille_prix_inscrit ?? null })
      .eq('etablissement_id', etablissementId).eq('mois', moisEnCours())
    if (eReleve) console.error('[option famille] releve du mois :', eReleve.message)
  }

  await tracerConsole(await createClient(), {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: etablissementId,
    description: `Console éditeur · espace famille ${actif ? 'activé' : 'désactivé'}`,
    etablissementId,
  })
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  revalidatePath('/superadmin/facturation')
  return {}
}

/** Tarif de l'option (forfait + prix par inscrit, base = celle du tarif de base, decision 20). */
export async function enregistrerTarifFamille(
  etablissementId: string,
  tarif: { forfait: number | null; prix: number | null },
): Promise<{ error?: string }> {
  const { error: garde } = await requireEditor()
  if (garde) return { error: garde }
  const effacee = await refuserSiEffacee(etablissementId)
  if (effacee) return { error: effacee }
  const montant = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0)
  if (!montant(tarif.forfait) || !montant(tarif.prix)) return { error: 'Les montants doivent être positifs.' }

  const admin = createAdminClient()
  const { error } = await admin.from('etablissement_facturation')
    .upsert({ etablissement_id: etablissementId, famille_forfait: tarif.forfait, famille_prix_inscrit: tarif.prix, updated_at: new Date().toISOString() },
      { onConflict: 'etablissement_id' })
  if (error) {
    console.error('[tarif famille]', error.message)
    return { error: 'Le tarif n’a pas pu être enregistré.' }
  }
  // Le mois en cours (pas encore facture) suit le nouveau tarif, comme le tarif de base.
  const { error: eReleve } = await admin.from('releves_facturation')
    .update({ famille_forfait: tarif.forfait, famille_prix_inscrit: tarif.prix })
    .eq('etablissement_id', etablissementId).eq('mois', moisEnCours()).eq('option_espace_famille', true)
  if (eReleve) console.error('[tarif famille] releve du mois :', eReleve.message)

  await tracerConsole(await createClient(), {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: etablissementId,
    description: `Console éditeur · tarif espace famille (forfait ${tarif.forfait === null ? 'aucun' : fmtEuro(tarif.forfait)}, prix par inscrit ${tarif.prix === null ? 'aucun' : fmtEuro(tarif.prix)})`,
    etablissementId,
  })
  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  revalidatePath('/superadmin/facturation')
  return {}
}
