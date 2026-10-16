import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Données du tableau de bord.
 *
 * Les fonctions RÉELLEMENT cachées utilisent `createAdminClient()` (service
 * role) et non `createClient()`, car `unstable_cache` interdit l'appel à
 * `cookies()` à l'intérieur d'une fonction cachée.
 * Voir : https://nextjs.org/docs/app/api-reference/functions/unstable_cache
 *
 * CONSÉQUENCE À NE JAMAIS PERDRE DE VUE : le service role contourne la RLS.
 * Toute requête cachée doit donc porter son propre cloisonnement — soit un
 * `etablissement_id` sur la table, soit une jointure `!inner` vers une table
 * qui le porte. Une clause oubliée fuit d'un établissement à l'autre.
 */

// ─── Profil (par utilisateur, cache 1 h) ─────────────────────────────────────

export const getCachedProfile = unstable_cache(
  async (userId: string) => {
    const supabase = createAdminClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return profile
  },
  ['dashboard-profile'],
  { tags: ['profile'] },
)

// ─── Établissement (mémoïsé par requête, plus de cache persistant) ───────────

/**
 * Établissement affiché dans la sidebar.
 *
 * PARAMÉTRÉE : le `.single()` sans filtre servait un établissement arbitraire —
 * et lèverait carrément dès le deuxième, `.single()` exigeant exactement une
 * ligne. En service-role la RLS ne rattrape rien, le filtre doit être explicite.
 *
 * ┌─ POURQUOI LE CACHE PERSISTANT A ÉTÉ RETIRÉ (10 août 2026) ──────────────┐
 * │ Mesuré depuis Vercel, `unstable_cache` répondait en 100 ms là où la      │
 * │ requête nue en met 60. Le cache de données est lui-même un appel réseau :│
 * │ il coûtait donc PLUS CHER que ce qu'il évitait, tout en ajoutant six     │
 * │ heures de péremption possible.                                          │
 * │                                                                          │
 * │ Même raisonnement que `getCurrentYear` le 4 août, et même bénéfice       │
 * │ second : hors `unstable_cache`, on n'est plus obligé du service-role.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `cache()` de React reste indispensable : la fonction est appelée par le layout
 * racine, le layout du tableau de bord ET le manifeste. Sans mémoïsation, une
 * même requête paierait trois allers-retours.
 */
export const getEtablissement = cache(async (etablissementId: string) => {
  if (!etablissementId) return null
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('etablissements')
    .select('nom, logo_url, subscription_expires_at, est_demo')
    .eq('id', etablissementId)
    .maybeSingle()
  return data
})

// ─── Année scolaire en cours (NON cachée, volontairement) ────────────────────

/**
 * Année scolaire en cours.
 *
 * **Délibérément sans cache.** Elle l'a été 24 h, avec le tag `school-year` —
 * qui n'était invalidé nulle part, car l'année est écrite depuis un composant
 * CLIENT (`SchoolYearForm`) où aucun `updateTag` ne peut s'accrocher. Après un
 * changement d'année en cours, tout le tableau de bord travaillait donc sur
 * l'ancienne pendant 24 h : périodes, calcul financier, compteurs d'évaluations
 * et de bulletins sont tous bornés sur cette valeur.
 *
 * Le calcul est une requête d'UNE ligne sur trois colonnes : le cache ne faisait
 * économiser presque rien, et coûtait une journée entière de chiffres faux.
 *
 * Bénéfice second : hors `unstable_cache`, on peut utiliser le client SESSION,
 * donc la RLS cloisonne l'établissement — ce que la version cachée, en service
 * role et sans filtre, ne faisait pas.
 */
export async function getCurrentYear() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
    .eq('is_current', true)
    .maybeSingle()
  return data
}

// ─── Compteurs du tableau de bord admin : RETIRES (16 octobre 2026) ─────────
//
// `getCachedAdminStats` lisait en service-role, sans RLS : le cloisonnement
// tenait a un filtre ecrit a la main sur chaque requete, et le role n'etait
// verifie que par la page. Les compteurs passent desormais par le client de
// session dans `lib/dashboard/direction.ts` : la RLS verifie l'ecole ET le role.
