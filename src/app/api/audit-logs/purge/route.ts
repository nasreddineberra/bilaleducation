import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveRole } from '@/lib/auth/effective-role'
import { PURGE_OPTIONS, type PurgeJours } from '@/lib/audit/purge-options'

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Verifier authentification + role
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, etablissement_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'direction'].includes(effectiveRole(profile) ?? '')) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    // Delai de conservation, choisi par la direction. VALIDE CONTRE LA LISTE :
    // une valeur libre venue du navigateur pourrait faire disparaitre toute la
    // periode qu'on croit garder, et une suppression de journal ne se rattrape
    // pas. Repli sur le mois, l'ancien comportement.
    const { searchParams } = new URL(request.url)
    const brut = Number(searchParams.get('jours'))
    const jours: PurgeJours = PURGE_OPTIONS.some(o => o.jours === brut)
      ? (brut as PurgeJours)
      : 30

    const admin = createAdminClient()

    let query = admin
      .from('audit_logs')
      .delete({ count: 'exact' })
      .eq('etablissement_id', profile.etablissement_id)

    // `0` = tout purger : pas de borne de date, sinon on ne supprimerait rien.
    if (jours > 0) {
      const limite = new Date()
      limite.setDate(limite.getDate() - jours)
      query = query.lt('created_at', limite.toISOString())
    }

    const { count, error } = await query
    if (error) throw error

    return NextResponse.json({ deleted: count ?? 0 })
  } catch (err) {
    console.error('Purge audit logs error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
