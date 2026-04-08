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
  const limit = checkRateLimit(`unsubscribe:${ip}`, 10)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez réessayer dans une minute.' }, { status: 429 })
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { endpoint } = await req.json()
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint manquant' }, { status: 400 })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)

    if (error) {
      logger.error('Erreur DB désinscription push', error)
      return NextResponse.json({ error: 'Erreur lors de la désinscription.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    logger.error('Erreur désinscription push', e)
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
