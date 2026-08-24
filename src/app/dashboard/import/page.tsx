import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import ImportClient from '@/components/import/ImportClient'
import type { FoyerExistant, EnfantExistant } from '@/lib/import/rapprocher'

/**
 * IMPORTATION DE FAMILLES — `Vie scolaire → Importation`.
 *
 * Reserve a la direction. La garde est posee ICI et pas seulement sur le lien de
 * la barre laterale : un ecran reste atteignable par son adresse.
 *
 * ── POURQUOI L'EXISTANT PART VERS LE NAVIGATEUR ────────────────────────────
 *
 * Le rapprochement tourne cote client, pour que la correction d'une cellule
 * soit revalidee INSTANTANEMENT. Le faire au serveur imposerait un aller-retour
 * a chaque frappe corrigee, sur un ecran dont tout l'objet est de corriger.
 *
 * Ce qui part est donc reduit au strict necessaire : de quoi reconnaitre un
 * foyer et reperer ce qui a change. Ni notes, ni identifiants de comptes.
 * L'utilisateur a de toute facon acces a ces fiches — c'est le meme
 * etablissement, et la RLS le lui accorde deja.
 */
export default async function ImportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profil } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', user.id)
    .single()

  const role = effectiveRole(profil)
  if (role !== 'admin' && role !== 'direction') redirect('/dashboard')

  const [{ data: parents }, { data: students }] = await Promise.all([
    supabase
      .from('parents')
      .select(`id,
        tutor1_last_name, tutor1_first_name, tutor1_email, tutor1_phone, tutor1_relationship,
        tutor1_address, tutor1_city, tutor1_postal_code, tutor1_profession,
        tutor2_last_name, tutor2_first_name, tutor2_email, tutor2_phone, tutor2_relationship,
        tutor2_address, tutor2_city, tutor2_postal_code, tutor2_profession,
        situation_familiale`)
      .order('tutor1_last_name'),

    supabase
      .from('students')
      .select('id, parent_id, last_name, first_name, date_of_birth'),
  ])

  const foyers: FoyerExistant[] = (parents ?? []).map(p => ({
    id: p.id,
    tutor1_last_name: p.tutor1_last_name,
    tutor1_first_name: p.tutor1_first_name,
    tutor2_last_name: p.tutor2_last_name,
    tutor2_first_name: p.tutor2_first_name,
    champs: p as unknown as Record<string, string | null>,
  }))

  return (
    <ImportClient
      foyers={foyers}
      enfants={(students ?? []) as EnfantExistant[]}
    />
  )
}
