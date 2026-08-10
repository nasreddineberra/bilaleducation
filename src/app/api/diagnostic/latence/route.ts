import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveRole } from '@/lib/auth/effective-role'
import { getCachedProfile, getCachedEtablissement, getCurrentYear } from '@/lib/cache/dashboard'

/**
 * ┌─ ROUTE DE DIAGNOSTIC — TEMPORAIRE ──────────────────────────────────────┐
 * │ À SUPPRIMER une fois la mesure faite. Elle n'a aucune raison de vivre    │
 * │ dans le produit : elle ne sert à personne d'autre qu'à nous, un soir.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * POURQUOI ELLE EXISTE. L'audit du 10 août a montré que la base n'est pas en
 * cause — 329 lignes au total, requêtes applicatives à 0,1 ms, et les seules
 * requêtes lentes appartiennent à l'infrastructure Supabase. Ce qui reste, ce
 * sont les ALLERS-RETOURS : chaque `await` du layout est un aller-retour HTTPS
 * complet entre la fonction Vercel et Supabase.
 *
 * Or ce coût ne se mesure pas depuis un poste de travail : il dépend de la
 * distance entre la région de la fonction et celle du projet Supabase. D'où
 * cette route, qui chronomètre DEPUIS VERCEL.
 *
 * Ce qu'elle ne fait pas : renvoyer la moindre donnée. Uniquement des durées.
 */

// `PromiseLike` et non `Promise` : les constructeurs de requête PostgREST sont
// *thenable* — on peut les attendre — mais ne sont pas de vraies promesses.
const chrono = async <T>(fn: () => PromiseLike<T>): Promise<[T, number]> => {
  const t = performance.now()
  const r = await fn()
  return [r, Math.round(performance.now() - t)]
}

export async function GET() {
  const supabase = await createClient()

  // La garde EST une mesure : `auth.getUser()` valide le jeton auprès du
  // serveur d'authentification, c'est le premier aller-retour de toute page.
  const [{ data: { user } }, msGetUser] = await chrono(() => supabase.auth.getUser())
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profil } = await supabase
    .from('profiles').select('role, etablissement_id').eq('id', user.id).maybeSingle()

  if (!['admin', 'direction'].includes(effectiveRole(profil) ?? '')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Aller-retour NU, répété ────────────────────────────────────────────────
  // Le MINIMUM est la bonne estimation du coût réseau : la moyenne est polluée
  // par le premier appel, qui paie l'établissement de la connexion TLS.
  const nus: number[] = []
  for (let i = 0; i < 6; i++) {
    const [, ms] = await chrono(() =>
      supabase.from('school_years').select('id').limit(1),
    )
    nus.push(ms)
  }

  // Même chose en service-role : client distinct, donc connexion distincte.
  const admin = createAdminClient()
  const [, msAdminNu] = await chrono(() => admin.from('school_years').select('id').limit(1))

  // ── La séquence RÉELLE du layout, étape par étape ──────────────────────────
  const tSeq = performance.now()
  const [profilCache, msProfil] = await chrono(() => getCachedProfile(user.id))
  const [annee, msAnnee] = await chrono(() => getCurrentYear())
  const [, msEtab] = await chrono(() =>
    profilCache?.etablissement_id
      ? getCachedEtablissement(profilCache.etablissement_id)
      : Promise.resolve(null),
  )
  const [, msStaffCount] = await chrono(() =>
    supabase.from('announcement_staff_recipients')
      .select('id, announcements!inner(channel)', { count: 'exact', head: true })
      .eq('profile_id', user.id).eq('is_read', false)
      .neq('announcements.channel', 'email'),
  )
  const [, msParents] = await chrono(() =>
    supabase.from('parents').select('id').eq('user_id', user.id).maybeSingle(),
  )
  const msSequence = Math.round(performance.now() - tSeq)

  return NextResponse.json({
    region_vercel: process.env.VERCEL_REGION ?? 'inconnue (local ?)',
    aller_retour_nu: {
      mesures_ms: nus,
      minimum_ms: Math.min(...nus),
      // Le minimum approche le coût RÉSEAU pur : la requête elle-même ne coûte
      // rien (0,1 ms mesuré en base), tout le reste est du transport.
      service_role_ms: msAdminNu,
    },
    layout: {
      auth_getUser_ms: msGetUser,
      profil_cache_ms: msProfil,
      annee_en_cours_ms: msAnnee,
      etablissement_cache_ms: msEtab,
      compteur_staff_ms: msStaffCount,
      lookup_parents_ms: msParents,
      total_sequence_ms: msSequence,
    },
    annee: annee?.label ?? null,
  })
}
