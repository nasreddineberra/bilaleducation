import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { endpoint, keys } = await req.json()
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Subscription invalide' }, { status: 400 })
    }

    // Récupérer l'etablissement_id du profil
    const { data: profile } = await supabase
      .from('profiles')
      .select('etablissement_id')
      .eq('id', user.id)
      .single()

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        etablissement_id: profile?.etablissement_id,
        endpoint,
        p256dh: keys.p256dh,
        auth_key: keys.auth,
      }, { onConflict: 'user_id,endpoint' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
