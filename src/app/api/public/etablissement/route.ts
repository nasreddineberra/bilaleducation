import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Route publique (sans auth) — nom et logo de l'établissement.
 * Utilisée par la page de connexion.
 *
 * N'expose QUE le nom et le logo. L'adresse de contact a été volontairement
 * écartée : cette route est publique, une adresse y serait offerte aux robots.
 * La page de connexion renvoie donc vers l'administration sans la citer.
 *
 * CLOISONNEMENT — l'établissement est identifié par l'en-tête
 * `x-etablissement-id`, posé par le middleware à partir du SOUS-DOMAINE. C'est
 * la seule source possible ici : la page de connexion n'a par définition aucune
 * session, donc aucun profil d'où déduire le tenant.
 *
 * L'ancienne version prenait le premier établissement actif venu, via un
 * `.limit(1).single()`. Avec un seul établissement le résultat était correct par
 * accident ; avec deux, la page de connexion d'une école aurait affiché le nom
 * et le logo d'une autre.
 */
export async function GET(req: NextRequest) {
  const repli = { nom: 'Bilal Education', logo_url: null }

  try {
    const etablissementId = req.headers.get('x-etablissement-id')
    if (!etablissementId) return NextResponse.json(repli)

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('etablissements')
      .select('nom, logo_url')
      .eq('id', etablissementId)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data) return NextResponse.json(repli)

    return NextResponse.json({ nom: data.nom, logo_url: data.logo_url ?? null })
  } catch {
    return NextResponse.json(repli)
  }
}
