import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Route publique (sans auth) — nom et logo de l'établissement.
 * Utilisée par la page de connexion.
 *
 * N'expose QUE le nom et le logo. L'adresse de contact a été volontairement
 * écartée : cette route est publique, une adresse y serait offerte aux robots.
 * La page de connexion renvoie donc vers l'administration sans la citer.
 */
export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('etablissements')
      .select('nom, logo_url')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ nom: 'Bilal Education', logo_url: null })
    }

    return NextResponse.json({ nom: data.nom, logo_url: data.logo_url ?? null })
  } catch {
    return NextResponse.json({ nom: 'Bilal Education', logo_url: null })
  }
}
