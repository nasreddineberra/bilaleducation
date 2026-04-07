import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification, getParentWithEmails } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireRole(['admin', 'direction', 'secretaire'])
    if (error) return error

    const { parent_id, amount, method, receipt, paid_date, etablissement_id } = await req.json()
    if (!parent_id || !amount) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const parent = await getParentWithEmails(parent_id)
    if (!parent) return NextResponse.json({ ok: true })

    const dateFormatted = paid_date
      ? new Date(paid_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    const methodLabel = METHOD_LABELS[method] ?? method ?? ''
    const title = `Paiement enregistré — ${fmtEur(amount)}`
    const body = `Votre paiement de ${fmtEur(amount)} par ${methodLabel} du ${dateFormatted} a bien été enregistré.${receipt ? ` Réf : ${receipt}.` : ''}`

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Confirmation de paiement</h2>
        <p style="color: #444; line-height: 1.6;">${body}</p>
        <table style="margin-top: 16px; font-size: 14px; color: #333;">
          <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Montant</td><td>${fmtEur(amount)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Moyen</td><td>${methodLabel}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Date</td><td>${dateFormatted}</td></tr>
          ${receipt ? `<tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Référence</td><td>${receipt}</td></tr>` : ''}
        </table>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">Bilal Education — Notification automatique</p>
      </div>
    `

    // Récupérer etablissement_id depuis la table parents
    let etabId = etablissement_id
    if (!etabId) {
      const supabase = createAdminClient()
      const { data: p } = await supabase.from('parents').select('etablissement_id').eq('id', parent_id).single()
      etabId = p?.etablissement_id
    }
    if (!etabId) return NextResponse.json({ ok: true })

    await createNotification({
      etablissement_id: etabId,
      type: 'payment',
      parent_id,
      title,
      body,
      metadata: { amount, method, receipt, paid_date },
      emailSubject: title,
      emailHtml,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[notif:payment]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
