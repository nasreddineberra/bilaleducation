import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { checkCsrf } from '@/lib/security/csrf'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  // Protection CSRF
  const csrf = checkCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 })
  }

  // Rate limiting : 10 requêtes/minute par IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const limit = checkRateLimit(`subscribe:${ip}`, 10)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez réessayer dans une minute.' }, { status: 429 })
  }

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

    if (error) {
      logger.error('Erreur DB inscription push', error)
      return NextResponse.json({ error: "Erreur lors de l'inscription." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    logger.error('Erreur inscription push', e)
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
