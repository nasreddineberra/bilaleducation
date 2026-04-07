import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification, getParentByStudentId } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireRole(['admin', 'direction', 'secretaire'])
    if (error) return error

    const { absences, etablissement_id } = await req.json()
    if (!absences?.length || !etablissement_id) {
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
        .single()

      if (!student) continue

      const classId = absences.find((a: any) => a.student_id === studentId)?.class_id
      let className = ''
      if (classId) {
        const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
        className = cls?.name ?? ''
      }

      for (const entry of entries) {
        const isRetard = entry.absence_type === 'retard'
        const typeLabel = isRetard ? 'en retard' : 'absent(e)'
        const typeNotif = isRetard ? 'retard' as const : 'absence' as const
        const dateFormatted = new Date(entry.absence_date).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })

        const title = isRetard
          ? `Retard de ${student.first_name} ${student.last_name}`
          : `Absence de ${student.first_name} ${student.last_name}`

        const body = `${student.first_name} ${student.last_name} a été marqué(e) ${typeLabel} le ${dateFormatted}${className ? ` — Classe ${className}` : ''}.`

        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">${title}</h2>
            <p style="color: #444; line-height: 1.6;">${body}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #999; font-size: 12px;">Bilal Education — Notification automatique</p>
          </div>
        `

        await createNotification({
          etablissement_id,
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
    console.error('[notif:absence]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
