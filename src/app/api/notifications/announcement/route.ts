import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications'

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createClient()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

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
    console.error('[notif:announcement]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
