import { NextRequest, NextResponse } from 'next/server'
import { formatJourLongFr } from '@/lib/dates'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'
import { coque, tableauInfos, POLICE, C } from '@/lib/email/shell.mjs'
import { marqueEcole } from '@/lib/email/marque-ecole'

export async function POST(req: NextRequest) {
  try {
    const { etablissementId, error } = await requireRole(['admin', 'direction', 'responsable_pedagogique', 'enseignant'])
    if (error) return error
    if (!etablissementId) {
      return NextResponse.json({ error: 'Etablissement non identifie.' }, { status: 403 })
    }

    // L'etablissement vient du PROFIL de l'appelant. Il etait auparavant fourni
    // par le client, qui pouvait donc poster le devoir d'un AUTRE etablissement
    // et declencher l'envoi d'emails a ses familles.
    const { homework_id } = await req.json()
    if (!homework_id) {
      return NextResponse.json({ error: 'Donnees manquantes' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Fetch homework with class + teacher info (cotisation → is_adult)
    const { data: hw } = await supabase
      .from('homework')
      .select('*, classes:class_id(name, cotisation_types(is_adult)), teachers:teacher_id(first_name, last_name, civilite)')
      .eq('id', homework_id)
      .eq('etablissement_id', etablissementId)   // le service-role ignore la RLS
      .maybeSingle()

    if (!hw) return NextResponse.json({ error: 'Devoir introuvable' }, { status: 404 })

    const isAdult = !!(hw.classes as any)?.cotisation_types?.is_adult

    // 2. Format
    const className = (hw.classes as any)?.name ?? ''
    const teacherInfo = hw.teachers as any
    const teacherLabel = teacherInfo
      ? `${teacherInfo.civilite ? teacherInfo.civilite + ' ' : ''}${teacherInfo.last_name} ${teacherInfo.first_name}`
      : ''
    const dueFormatted = formatJourLongFr(hw.due_date)

    const HW_TYPE_LABELS: Record<string, string> = {
      exercice: 'Exercice',
      lecon: 'Leçon à apprendre',
      expose: 'Exposé',
      autre: 'Devoir',
    }
    const typeLabel = HW_TYPE_LABELS[hw.homework_type] ?? 'Devoir'
    // 'General' est la valeur stockee (sentinelle sans accent, cf. DevoirForm) ;
    // la famille lit « Général ».
    const matiere = hw.subject === 'General' ? 'Général' : hw.subject

    const ecole = await marqueEcole(supabase, etablissementId)

    // 3. Destinataires selon le type de classe, AVEC les personnes concernees :
    // le mail est construit PAR FOYER pour pouvoir nommer l'enfant. Un parent
    // ne connait pas forcement le code de la classe de son enfant (vu sur le
    // premier envoi reel, 20/09) ; « lequel de mes enfants ? » est sa premiere
    // question. Une fratrie dans la meme classe donne plusieurs noms.
    // - Classe enfant : eleves inscrits → foyer (email aux 2 tuteurs).
    // - Classe adulte : participant = le tuteur inscrit, email a lui seul.
    type Recipient = {
      parent_id: string
      tutor_number?: number
      emailsOverride?: string[]
      concernes: string[]       // « NOM Prenom » des eleves / du participant
    }
    const recipients: Recipient[] = []

    if (isAdult) {
      const { data: participants } = await supabase
        .from('parent_class_enrollments')
        .select('parent_id, tutor_number, parents:parent_id(tutor1_email, tutor2_email, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
        .eq('class_id', hw.class_id)
        .eq('status', 'active')

      for (const p of (participants ?? []) as any[]) {
        const t = p.tutor_number === 1 ? 1 : 2
        const email = p.parents?.[`tutor${t}_email`]
        const nom = `${p.parents?.[`tutor${t}_last_name`] ?? ''} ${p.parents?.[`tutor${t}_first_name`] ?? ''}`.trim()
        recipients.push({
          parent_id: p.parent_id,
          tutor_number: p.tutor_number,
          // Toujours forcé (même vide) : ne jamais retomber sur les 2 emails du foyer.
          emailsOverride: email ? [email] : [],
          concernes: nom ? [nom] : [],
        })
      }
    } else {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id, students:student_id(id, parent_id, last_name, first_name)')
        .eq('class_id', hw.class_id)
        .eq('status', 'active')

      const parFoyer = new Map<string, string[]>()
      for (const e of (enrollments as any[] ?? [])) {
        const st = e.students
        if (!st?.parent_id) continue
        const liste = parFoyer.get(st.parent_id) ?? []
        liste.push(`${st.last_name} ${st.first_name}`)
        parFoyer.set(st.parent_id, liste)
      }
      for (const [parent_id, concernes] of parFoyer) recipients.push({ parent_id, concernes })
    }

    if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    // 4. Un mail par foyer, qui nomme qui est concerne.
    let sent = 0
    for (const r of recipients) {
      const qui = r.concernes.join(' · ')
      const title = qui ? `Nouveau devoir · ${qui}` : `Nouveau devoir · ${className}`
      const body = `${hw.title} (${typeLabel}) · À rendre le ${dueFormatted}`

      // Coque a la marque de L'ECOLE : la famille recoit un devoir de son
      // etablissement, pas du fournisseur du logiciel.
      const emailHtml = coque({
        titre: title,
        apercu: body,
        corps: [
          tableauInfos(([
            [isAdult ? 'Participant' : (r.concernes.length > 1 ? 'Élèves' : 'Élève'), qui],
            ['Classe', className],
            ['Matière', matiere],
            ['Type', typeLabel],
            ['Titre', hw.title],
            ['À rendre le', `<strong>${dueFormatted}</strong>`],
            ['Enseignant', teacherLabel],
          ] as [string, string][]).filter(([, v]) => !!v)),
          // Consignes redigees dans l'editeur riche : deja du HTML.
          hw.description_html
            ? `              <div style="background:#faf8f6; border-left:3px solid ${C.bouton}; padding:14px 16px; border-radius:0 8px 8px 0; font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">${hw.description_html}</div>`
            : '',
        ].filter(Boolean).join('\n'),
        ecole: { nom: ecole.nom, logoUrl: ecole.logoUrl },
      })

      await createNotification({
        etablissement_id: etablissementId,
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
