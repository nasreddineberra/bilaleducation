import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireRole(['admin', 'direction', 'responsable_pedagogique', 'enseignant'])
    if (error) return error

    const { homework_id, etablissement_id } = await req.json()
    if (!homework_id || !etablissement_id) {
      return NextResponse.json({ error: 'Donnees manquantes' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch homework with class + teacher info (cotisation → is_adult)
    const { data: hw } = await supabase
      .from('homework')
      .select('*, classes:class_id(name, cotisation_types(is_adult)), teachers:teacher_id(first_name, last_name, civilite)')
      .eq('id', homework_id)
      .single()

    if (!hw) return NextResponse.json({ error: 'Devoir introuvable' }, { status: 404 })

    const isAdult = !!(hw.classes as any)?.cotisation_types?.is_adult

    // 2. Format
    const className = (hw.classes as any)?.name ?? ''
    const teacherInfo = hw.teachers as any
    const teacherLabel = teacherInfo
      ? `${teacherInfo.civilite ? teacherInfo.civilite + ' ' : ''}${teacherInfo.first_name} ${teacherInfo.last_name}`
      : ''
    const dueFormatted = new Date(hw.due_date).toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    })

    const HW_TYPE_LABELS: Record<string, string> = {
      exercice: 'Exercice',
      lecon: 'Leçon à apprendre',
      expose: 'Expose',
      autre: 'Devoir',
    }
    const typeLabel = HW_TYPE_LABELS[hw.homework_type] ?? 'Devoir'

    const title = `Nouveau devoir — ${className}`
    const body = `${hw.title} (${typeLabel}) — A rendre le ${dueFormatted}`

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a365d; margin-bottom: 8px;">${title}</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; background: #f7fafc;">Classe</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${className}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; background: #f7fafc;">Matiere</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${hw.subject}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; background: #f7fafc;">Type</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${typeLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; background: #f7fafc;">Titre</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${hw.title}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; background: #f7fafc; color: #c53030;">A rendre le</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; color: #c53030;">${dueFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: bold; background: #f7fafc;">Enseignant</td>
            <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${teacherLabel}</td>
          </tr>
        </table>
        ${hw.description_html ? `<div style="margin-top: 12px; padding: 12px; background: #f7fafc; border-radius: 6px;">${hw.description_html}</div>` : ''}
        <p style="color: #718096; font-size: 12px; margin-top: 24px;">Bilal Education — Notification automatique</p>
      </div>
    `

    // 3. Construire les destinataires selon le type de classe.
    // - Classe enfant : élèves inscrits → parent (email aux 2 tuteurs du foyer).
    // - Classe adulte : participants (tuteurs) → email UNIQUEMENT au tuteur inscrit.
    type Recipient = { parent_id: string; tutor_number?: number; emailsOverride?: string[] }
    const recipients: Recipient[] = []

    if (isAdult) {
      const { data: participants } = await supabase
        .from('parent_class_enrollments')
        .select('parent_id, tutor_number, parents:parent_id(tutor1_email, tutor2_email)')
        .eq('class_id', hw.class_id)
        .eq('status', 'active')

      for (const p of (participants ?? []) as any[]) {
        const email = p.tutor_number === 1 ? p.parents?.tutor1_email : p.parents?.tutor2_email
        recipients.push({
          parent_id: p.parent_id,
          tutor_number: p.tutor_number,
          // Toujours forcé (même vide) : ne jamais retomber sur les 2 emails du foyer.
          emailsOverride: email ? [email] : [],
        })
      }
    } else {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, students:student_id(id, parent_id)')
        .eq('class_id', hw.class_id)
        .eq('status', 'active')

      const parentIds = [...new Set(
        (enrollments as any[] ?? [])
          .map(e => e.students?.parent_id)
          .filter(Boolean)
      )]
      for (const id of parentIds) recipients.push({ parent_id: id })
    }

    if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    // 4. Send notifications
    let sent = 0
    for (const r of recipients) {
      await createNotification({
        etablissement_id,
        type: 'homework',
        parent_id: r.parent_id,
        title,
        body,
        metadata: { homework_id, subject: hw.subject, due_date: hw.due_date, ...(r.tutor_number ? { tutor_number: r.tutor_number } : {}) },
        emailSubject: title,
        emailHtml,
        ...(r.emailsOverride ? { emailsOverride: r.emailsOverride } : {}),
      })
      sent++
    }

    return NextResponse.json({ ok: true, sent })
  } catch (err: any) {
    console.error('[notifications/homework]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
