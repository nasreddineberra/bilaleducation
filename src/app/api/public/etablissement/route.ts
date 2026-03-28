import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Route publique (sans auth) — retourne nom et logo de l'établissement
 * Utilisée par la page de connexion
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
