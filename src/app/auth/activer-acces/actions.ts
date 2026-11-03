'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { empreinteJeton, jetonBienForme } from '@/lib/espace-famille/jeton'

/**
 * ACTIVER L'ACCES D'UN PARENT a partir de son jeton d'invitation.
 *
 * POST, declenche par un vrai clic (meme parade que `/auth/confirm` : les
 * inspecteurs de liens des messageries ouvrent les URL et consommeraient un
 * jeton a usage unique).
 *
 * `invitations_famille` est une table SERVEUR (aucune regle) : le client admin
 * la lit, borne a l'ecole du sous-domaine. La session est ensuite ouverte par
 * un lien de reinitialisation Supabase GENERE ET VERIFIE ici, sans email : le
 * delai d'une heure de ce lien ne court donc qu'a partir du clic, et l'ecran
 * « Choisissez votre mot de passe » existant fait le reste.
 */
export async function activerAcces(formData: FormData) {
  const jeton = formData.get('jeton')
  if (!jetonBienForme(jeton)) redirect('/auth/activer-acces?motif=invalide')

  const etablissementId = (await headers()).get('x-etablissement-id')
  if (!etablissementId) redirect('/auth/activer-acces?motif=invalide')

  const admin = createAdminClient()
  const empreinte = empreinteJeton(jeton)

  const { data: invitation } = await admin
    .from('invitations_famille')
    .select('id, profile_id')
    .eq('empreinte', empreinte)
    .eq('etablissement_id', etablissementId)
    .is('utilise_le', null)
    .is('annule_le', null)
    .gt('expire_le', new Date().toISOString())
    .maybeSingle()
  if (!invitation) redirect('/auth/activer-acces?motif=invalide')

  // Option active ET espace ouvert par l'ecole, compte actif : sinon rien a activer.
  const [{ data: etab }, { data: profil }] = await Promise.all([
    admin.from('etablissements').select('option_espace_famille, espace_famille_ouvert').eq('id', etablissementId).maybeSingle(),
    admin.from('profiles').select('is_active, role').eq('id', invitation.profile_id).maybeSingle(),
  ])
  if (!etab?.option_espace_famille || !etab.espace_famille_ouvert || !profil?.is_active || profil.role !== 'parent') {
    redirect('/auth/activer-acces?motif=indisponible')
  }

  const { data: utilisateur, error: errUser } = await admin.auth.admin.getUserById(invitation.profile_id)
  const email = utilisateur?.user?.email
  if (errUser || !email) {
    console.error('[activerAcces] compte introuvable :', errUser?.message)
    redirect('/auth/activer-acces?motif=invalide')
  }

  const { data: lien, error: errLien } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const tokenHash = lien?.properties?.hashed_token
  if (errLien || !tokenHash) {
    console.error('[activerAcces] lien non genere :', errLien?.message)
    redirect('/auth/activer-acces?motif=erreur')
  }

  const supabase = await createClient()
  const { error: errOtp } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (errOtp) {
    console.error('[activerAcces] session non ouverte :', errOtp.code ?? '(sans code)', errOtp.message)
    redirect('/auth/activer-acces?motif=erreur')
  }

  // Jeton consomme APRES l'ouverture de la session : un echec plus haut laisse
  // l'invitation utilisable. Condition repetee : deux clics simultanes n'en
  // consomment qu'un.
  const { error: errUse } = await admin
    .from('invitations_famille')
    .update({ utilise_le: new Date().toISOString() })
    .eq('id', invitation.id)
    .is('utilise_le', null)
  if (errUse) console.error('[activerAcces] jeton non marque utilise :', errUse.message)

  redirect('/auth/reset-password')
}
