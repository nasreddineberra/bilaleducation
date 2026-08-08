import { NextRequest, NextResponse } from 'next/server'
import { FUSEAU } from '@/lib/dates'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification, getParentWithEmails } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { checkCsrf } from '@/lib/security/csrf'
import { logger } from '@/lib/logger'
import { coque, tableauInfos, p } from '@/lib/email/shell.mjs'
import { marqueEcole } from '@/lib/email/marque-ecole'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

export async function POST(req: NextRequest) {
  // Protection CSRF
  const csrf = checkCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 })
  }

  // Rate limiting : 10 requêtes/minute par IP
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const limit = checkRateLimit(`payment:${ip}`, 10)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez réessayer dans une minute.' }, { status: 429 })
  }

  try {
    const { user, etablissementId, error } = await requireRole(['admin', 'direction', 'secretaire'])
    if (error) return error
    if (!etablissementId) {
      return NextResponse.json({ error: 'Établissement non identifié.' }, { status: 403 })
    }

    // L'établissement vient du PROFIL de l'appelant, jamais du corps de la requête.
    const { parent_id, amount, method, receipt, paid_date } = await req.json()
    if (!parent_id || !amount) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Le foyer doit relever de l'établissement de l'appelant : le service-role
    // qui suit ignore la RLS, la vérification nous incombe.
    const admin = createAdminClient()
    const { data: parentTenant } = await admin
      .from('parents')
      .select('id')
      .eq('id', parent_id)
      .eq('etablissement_id', etablissementId)
      .maybeSingle()
    if (!parentTenant) {
      return NextResponse.json({ error: 'Famille introuvable.' }, { status: 404 })
    }

    const parent = await getParentWithEmails(parent_id)
    if (!parent) return NextResponse.json({ ok: true })

    const dateFormatted = paid_date
      ? new Date(paid_date).toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long', year: 'numeric' })

    const methodLabel = METHOD_LABELS[method] ?? method ?? ''
    const title = `Paiement enregistré · ${fmtEur(amount)}`
    const body = `Votre paiement de ${fmtEur(amount)} par ${methodLabel} du ${dateFormatted} a bien été enregistré.${receipt ? ` Réf : ${receipt}.` : ''}`

    const ecole = await marqueEcole(admin, etablissementId)

    // Coque a la marque de L'ECOLE : c'est elle qui encaisse et qui confirme.
    const emailHtml = coque({
      titre: "Confirmation de paiement",
      apercu: body,
      corps: [
        p(body),
        tableauInfos([
          ["Montant", fmtEur(amount)],
          ["Moyen", methodLabel],
          ["Date", dateFormatted],
          receipt ? ["Reference", receipt] : null,
        ].filter(Boolean) as Array<[string, string]>),
      ].join('\n'),
      ecole: { nom: ecole.nom, logoUrl: ecole.logoUrl },
    })

    const etabId = etablissementId
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
    logger.error('Erreur notification paiement', e)
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
