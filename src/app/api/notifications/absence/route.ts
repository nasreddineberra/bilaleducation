import { NextRequest, NextResponse } from 'next/server'
import { formatJourLongFr } from '@/lib/dates'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification, getParentByStudentId } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'
import { checkRateLimit } from '@/lib/security/rateLimiter'
import { checkCsrf } from '@/lib/security/csrf'
import { logger } from '@/lib/logger'
import { coque, p } from '@/lib/email/shell.mjs'
import { marqueEcole } from '@/lib/email/marque-ecole'

export async function POST(req: NextRequest) {
  // Protection CSRF
  const csrf = checkCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 })
  }

  // Rate limiting : 20 requêtes/minute par IP (marquage d'absences multiples)
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const limit = checkRateLimit(`absence:${ip}`, 20)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Trop de requêtes. Veuillez réessayer dans une minute.' }, { status: 429 })
  }

  try {
    const { user, etablissementId, error } = await requireRole(['admin', 'direction', 'secretaire'])
    if (error) return error
    if (!etablissementId) {
      return NextResponse.json({ error: 'Établissement non identifié.' }, { status: 403 })
    }

    // L'établissement vient du PROFIL de l'appelant, jamais du corps de la
    // requête : il y était fourni par le client, qui pouvait donc désigner un
    // autre établissement et déclencher des envois chez lui.
    const { absences } = await req.json()
    if (!absences?.length) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Grouper par student_id pour éviter les doublons
    const byStudent = new Map<string, { absence_type: string; absence_date: string; id: string }[]>()
    for (const a of absences) {
      const list = byStudent.get(a.student_id) ?? []
      list.push({ absence_type: a.absence_type, absence_date: a.absence_date, id: a.id })
      byStudent.set(a.student_id, list)
    }

    for (const [studentId, entries] of byStudent) {
      // Récupérer le parent
      const parent = await getParentByStudentId(studentId)
      if (!parent) continue

      // Récupérer les infos de l'élève et de la classe
      const { data: student } = await supabase
        .from('students')
        .select('first_name, last_name')
        .eq('id', studentId)
        .eq('etablissement_id', etablissementId)   // le service-role ignore la RLS
        .maybeSingle()

      if (!student) continue

      const classId = absences.find((a: any) => a.student_id === studentId)?.class_id
      let className = ''
      if (classId) {
        const { data: cls } = await supabase.from('classes').select('name')
          .eq('id', classId).eq('etablissement_id', etablissementId).maybeSingle()
        className = cls?.name ?? ''
      }

      for (const entry of entries) {
        const isRetard = entry.absence_type === 'retard'
        const typeLabel = isRetard ? 'en retard' : 'absent(e)'
        const typeNotif = isRetard ? 'retard' as const : 'absence' as const
        const dateFormatted = formatJourLongFr(entry.absence_date)

        const title = isRetard
          ? `Retard de ${student.last_name} ${student.first_name}`
          : `Absence de ${student.last_name} ${student.first_name}`

        const body = `${student.last_name} ${student.first_name} a été marqué(e) ${typeLabel} le ${dateFormatted}${className ? ` · Classe ${className}` : ''}.`

        const ecole = await marqueEcole(supabase, etablissementId)

        // Coque a la marque de L'ECOLE. Le pied signait « Bilal Education ·
        // Notification automatique » : le fournisseur du logiciel s'attribuait
        // un message qui vient de l'etablissement.
        const emailHtml = coque({
          titre: title,
          apercu: body,
          corps: p(body),
          ecole: { nom: ecole.nom, logoUrl: ecole.logoUrl },
        })

        await createNotification({
          etablissement_id: etablissementId,
          type: typeNotif,
          parent_id: parent.id,
          student_id: studentId,
          title,
          body,
          metadata: { absence_id: entry.id },
          emailSubject: title,
          emailHtml,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    logger.error('Erreur notification absence', e)
    return NextResponse.json({ error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
