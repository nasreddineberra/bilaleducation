import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { checkCsrf } from '@/lib/security/csrf'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  // Protection CSRF
  const csrf = checkCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 })
  }

  // Rate limiting : 20 requêtes/minute par IP (envoi d'annonces multiples)
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const limit = checkRateLimit(`announcement:${ip}`, 20)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez réessayer dans une minute.' }, { status: 429 })
  }

  try {
    const { user, error } = await requireRole(['admin', 'direction', 'secretaire'])
    if (error) return error

    const { announcement_id, etablissement_id } = await req.json()
    if (!announcement_id || !etablissement_id) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Récupérer l'annonce
    const { data: announcement } = await supabase
      .from('announcements')
      .select('id, title, content, body_html')
      .eq('id', announcement_id)
      .single()

    if (!announcement) return NextResponse.json({ ok: true })

    // Récupérer les destinataires parents
    const { data: recipients } = await supabase
      .from('announcement_recipients')
      .select('id, parent_id, email')
      .eq('announcement_id', announcement_id)

    if (!recipients?.length) return NextResponse.json({ ok: true })

    // Pour chaque parent, créer une notification + envoyer email + push
    for (const r of recipients) {
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">${announcement.title}</h2>
          <div style="color: #444; line-height: 1.6;">
            ${announcement.body_html || announcement.content || ''}
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Bilal Education — Message de l'établissement</p>
        </div>
      `

      await createNotification({
        etablissement_id,
        type: 'announcement',
        parent_id: r.parent_id,
        title: announcement.title,
        body: announcement.content?.substring(0, 200) || announcement.title,
        metadata: { announcement_id },
        emailSubject: announcement.title,
        emailHtml,
      })

      // Mettre à jour le statut email dans announcement_recipients
      await supabase
        .from('announcement_recipients')
        .update({ email_status: 'sent' })
        .eq('id', r.id)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    logger.error('Erreur notification annonce', e)
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
