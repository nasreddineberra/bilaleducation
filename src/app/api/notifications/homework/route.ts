import { NextRequest, NextResponse } from 'next/server'
import { formatJourLongFr } from '@/lib/dates'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { requireRole } from '@/lib/auth/requireRole'
import { coque, tableauInfos, POLICE, C } from '@/lib/email/shell.mjs'
import { marqueEcole } from '@/lib/email/marque-ecole'
import { sanitize } from '@/lib/security/sanitize'
import { destinatairesDeLaClasse } from '@/lib/email/destinataires-classe'
import { messageErreur } from '@/lib/erreur'
import { nomCompletEnseignant } from '@/lib/teachers/nom'

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

    const isAdult = !!hw.classes?.cotisation_types?.is_adult

    // 2. Format
    const className = hw.classes?.name ?? ''
    const teacherLabel = nomCompletEnseignant(hw.teachers)
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
    // Source unique `destinatairesDeLaClasse` (meme resolution que la modification
    // et la suppression d un devoir ; la route la recopiait).
    const recipients = await destinatairesDeLaClasse(supabase, hw.class_id, isAdult)

    if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0 })

    // Les consignes viennent de l'editeur riche, donc d'une SAISIE : c'est du
    // HTML de provenance inconnue, et non du HTML de confiance. La colonne
    // `description_html` est ecrite DIRECTEMENT depuis le navigateur par
    // `DevoirForm` — un appel REST peut donc y placer n'importe quoi, et ce mail
    // part a toutes les familles de la classe. Les modales de detail sanitisent
    // deja au rendu ; l'email etait le seul consommateur qui l'avait oublie.
    //
    // Calcule UNE FOIS, hors de la boucle : `sanitize()` analyse la chaine a
    // chaque appel (l'instance est en cache, pas l'analyse), et la boucle
    // ci-dessous tourne une fois par FOYER — soit 200-300 analyses de la meme
    // chaine sur une classe pleine.
    //
    // Config standard, volontairement PAS durcie pour l'email : elle conserve
    // `style`, dont la palette de couleurs de l'editeur a besoin.
    const consignes = sanitize(hw.description_html)

    // 4. Un mail par foyer, qui nomme qui est concerne.
    let sent = 0
    for (const r of recipients) {
      const qui = r.nom
      const title = qui ? `Nouveau devoir · ${qui}` : `Nouveau devoir · ${className}`
      const body = `${hw.title} (${typeLabel}) · À rendre le ${dueFormatted}`

      // Coque a la marque de L'ECOLE : la famille recoit un devoir de son
      // etablissement, pas du fournisseur du logiciel.
      const emailHtml = coque({
        titre: title,
        apercu: body,
        corps: [
          tableauInfos(([
            [isAdult ? 'Participant' : (r.noms.length > 1 ? 'Élèves' : 'Élève'), qui],
            ['Classe', className],
            ['Matière', matiere],
            ['Type', typeLabel],
            ['Titre', hw.title],
            ['À rendre le', `<strong>${dueFormatted}</strong>`],
            ['Enseignant', teacherLabel],
          ] as [string, string][]).filter(([, v]) => !!v)),
          // On teste la valeur SANITISEE et non la brute : une consigne ne
          // contenant qu'un `<script>` ressort vide, et un encadre borde vide
          // se lirait comme un defaut d'affichage. Motif de DevoirDetailModal.
          consignes.trim()
            ? `              <div style="background:#faf8f6; border-left:3px solid ${C.bouton}; padding:14px 16px; border-radius:0 8px 8px 0; font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">${consignes}</div>`
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
  } catch (err: unknown) {
    console.error('[notifications/homework]', err)
    return NextResponse.json({ error: messageErreur(err) ?? 'Une erreur est survenue.' }, { status: 500 })
  }
}
