import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE() {
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

    if (!profile || !['admin', 'direction'].includes(profile.role)) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
    }

    // Supprimer les logs > 1 mois via admin client (bypass RLS pour DELETE)
    const admin = createAdminClient()
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const { count, error } = await admin
      .from('audit_logs')
      .delete({ count: 'exact' })
      .eq('etablissement_id', profile.etablissement_id)
      .lt('created_at', oneMonthAgo.toISOString())

    if (error) throw error

    return NextResponse.json({ deleted: count ?? 0 })
  } catch (err) {
    console.error('Purge audit logs error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
