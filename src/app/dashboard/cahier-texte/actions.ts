'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { effectiveRole } from '@/lib/auth/effective-role'
import { createNotification } from '@/lib/notifications'
import { marqueEcole } from '@/lib/email/marque-ecole'
import { coque, tableauInfos, POLICE, C } from '@/lib/email/shell.mjs'
import { formatJourLongFr } from '@/lib/dates'

/**
 * Suppression d'un devoir et d'une séance du cahier de texte.
 *
 * AUCUNE SUPPRESSION N'EXISTAIT dans l'écran (constaté le 24/09) : la base
 * l'autorisait pourtant depuis la phase B du 13 juillet (`homework_teacher_delete`,
 * `journal_teacher_delete` sur ses propres entrées), mais rien ne l'offrait.
 *
 * ── POURQUOI UNE SERVER ACTION ET NON UN `delete()` DEPUIS LE NAVIGATEUR ────
 *
 * Trois raisons, dans cet ordre :
 *   1. la FENÊTRE de suppression doit être vérifiée côté serveur — masquer un
 *      bouton ne protège rien ;
 *   2. l'ORDRE compte : on supprime d'abord, on prévient ensuite. Prévenir avant
 *      risquerait d'annoncer une annulation qui n'a pas eu lieu ; prévenir après
 *      exige d'avoir capturé les destinataires AVANT que la ligne ne disparaisse ;
 *   3. la trace (`logAudit`) s'écrit pendant qu'on sait encore ce qu'on efface.
 *
 * ── LA FENÊTRE (arbitrage utilisateur du 24/09) ────────────────────────────
 *
 *   . DEVOIR  : tant que la date de rendu n'est pas passée. Après, c'est de
 *               l'historique — et les familles ont pu le faire.
 *   . SÉANCE  : dans les 7 jours. Même fenêtre que la préparation d'un
 *               remplaçant (13 juillet), par cohérence.
 *   . Le délai est une règle d'ENSEIGNANT. L'encadrement supprime sans fenêtre :
 *     c'est lui qui corrige les erreurs anciennes. La confirmation, elle, vaut
 *     pour tout le monde — elle se pose à l'écran.
 */

const ENCADREMENT = ['admin', 'direction', 'responsable_pedagogique']

/** Jours entre deux dates `AAAA-MM-JJ`, en arithmétique de nombres —
 *  aucun objet `Date`, donc aucun fuseau (piège payé plusieurs fois). */
function joursEcoules(dateIso: string): number {
  const [ay, am, ad] = dateIso.slice(0, 10).split('-').map(Number)
  const now = new Date()
  const utcA = Date.UTC(ay, am - 1, ad)
  const utcB = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((utcB - utcA) / 86_400_000)
}

type Resultat = { error?: string; avertissement?: string }

// ═══════════════════════════════════════════════════════════════════════════
//  DEVOIR
// ═══════════════════════════════════════════════════════════════════════════

export async function supprimerDevoir(id: string): Promise<Resultat> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profil } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', user.id)
    .single()
  const role = effectiveRole(profil) ?? ''
  const etablissementId = profil?.etablissement_id
  if (!etablissementId) return { error: 'Établissement introuvable.' }

  const { data: hw } = await supabase
    .from('homework')
    .select('id, title, due_date, homework_type, subject, class_id, teacher_id, etablissement_id, classes:class_id(name, cotisation_types(is_adult)), teachers:teacher_id(user_id, civilite, first_name, last_name)')
    .eq('id', id)
    .maybeSingle()

  if (!hw || hw.etablissement_id !== etablissementId) return { error: 'Devoir introuvable.' }

  // ── Droit et fenêtre ──
  const teacher = hw.teachers as any
  const estAuteur = teacher?.user_id === user.id
  if (!ENCADREMENT.includes(role)) {
    if (!estAuteur) return { error: 'Seul son auteur peut supprimer ce devoir.' }
    if (joursEcoules(hw.due_date) > 0) {
      return { error: 'La date de rendu est passée : ce devoir appartient désormais à l’historique.' }
    }
  }

  // ── Destinataires capturés AVANT la suppression ──
  // La ligne va disparaître : ses foyers avec elle si on attend.
  const isAdult = !!(hw.classes as any)?.cotisation_types?.is_adult
  type Dest = { parent_id: string; emailsOverride?: string[]; nom: string }
  const destinataires: Dest[] = []

  if (isAdult) {
    const { data: participants } = await supabase
      .from('parent_class_enrollments')
      .select('parent_id, tutor_number, parents:parent_id(tutor1_email, tutor2_email, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
      .eq('class_id', hw.class_id)
      .eq('status', 'active')

    for (const p of (participants ?? []) as any[]) {
      const t = p.tutor_number === 2 ? 2 : 1
      const email = p.parents?.[`tutor${t}_email`]
      const nom = `${p.parents?.[`tutor${t}_last_name`] ?? ''} ${p.parents?.[`tutor${t}_first_name`] ?? ''}`.trim()
      destinataires.push({ parent_id: p.parent_id, emailsOverride: email ? [email] : [], nom })
    }
  } else {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('students:student_id(parent_id, last_name, first_name)')
      .eq('class_id', hw.class_id)
      .eq('status', 'active')

    const parFoyer = new Map<string, string[]>()
    for (const e of (enrollments ?? []) as any[]) {
      const st = e.students
      if (!st?.parent_id) continue
      const liste = parFoyer.get(st.parent_id) ?? []
      liste.push(`${st.last_name} ${st.first_name}`)
      parFoyer.set(st.parent_id, liste)
    }
    for (const [parent_id, noms] of parFoyer) destinataires.push({ parent_id, nom: noms.join(' · ') })
  }

  // ── Trace AVANT d'effacer : après, on ne saurait plus quoi écrire ──
  await logAudit(supabase, {
    action: 'DELETE',
    entityType: 'homework',
    entityId: id,
    description: `Devoir supprime : « ${hw.title} » · ${(hw.classes as any)?.name ?? ''} · a rendre le ${hw.due_date}`,
  })

  // ── La suppression. `.select()` : écartée par la RLS, elle n'écrit rien ET
  //    ne lève rien — sans ce contrôle, un refus passerait pour un succès.
  const { data: supprimes, error } = await supabase
    .from('homework')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!supprimes || supprimes.length === 0) {
    return { error: 'Votre rôle ne permet pas de supprimer ce devoir.' }
  }

  revalidatePath('/dashboard/cahier-texte')

  // ── Prévenir les familles, APRÈS coup ──
  // Un devoir annoncé par email puis effacé sans un mot ferait travailler un
  // enfant sur un devoir annulé. L'échec de l'envoi ne défait pas la
  // suppression : elle a eu lieu, on le dit en avertissement (motif de
  // l'alerte de changement d'email, 9 août).
  const ecole = await marqueEcole(supabase, etablissementId)
  const teacherLabel = teacher
    ? `${teacher.civilite ? teacher.civilite + ' ' : ''}${teacher.last_name} ${teacher.first_name}`
    : ''
  let echecs = 0

  for (const d of destinataires) {
    const titre = d.nom ? `Devoir annulé · ${d.nom}` : 'Devoir annulé'
    const corps = `${hw.title} · ${(hw.classes as any)?.name ?? ''}`

    const html = coque({
      titre,
      apercu: corps,
      corps: [
        `              <div style="font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">Ce devoir est annulé : il n'est plus à faire.</div>`,
        tableauInfos(([
          [isAdult ? 'Participant' : 'Élève', d.nom],
          ['Classe', (hw.classes as any)?.name ?? ''],
          ['Titre', hw.title],
          ['Était à rendre le', formatJourLongFr(hw.due_date)],
          ['Enseignant', teacherLabel],
        ] as [string, string][]).filter(([, v]) => !!v)),
      ].filter(Boolean).join('\n'),
      ecole: { nom: ecole.nom, logoUrl: ecole.logoUrl },
    })

    const res = await createNotification({
      etablissement_id: etablissementId,
      type: 'homework',
      parent_id: d.parent_id,
      title: titre,
      body: corps,
      metadata: { homework_id: id, annule: true },
      emailSubject: titre,
      emailHtml: html,
      ...(d.emailsOverride ? { emailsOverride: d.emailsOverride } : {}),
    })
    if (!res.ok) echecs++
  }

  if (echecs > 0) {
    return { avertissement: `Devoir supprimé. ${echecs} famille${echecs > 1 ? 's n’ont' : ' n’a'} pas pu être prévenue${echecs > 1 ? 's' : ''} par email.` }
  }
  return {}
}

// ═══════════════════════════════════════════════════════════════════════════
//  SÉANCE
// ═══════════════════════════════════════════════════════════════════════════

/** Fenêtre de suppression d'une séance, en jours. Même valeur que la fenêtre de
 *  préparation d'un remplaçant (13 juillet) : une seule notion de « récent ». */
const FENETRE_SEANCE_JOURS = 7

export async function supprimerSeance(id: string): Promise<Resultat> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profil } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', user.id)
    .single()
  const role = effectiveRole(profil) ?? ''
  const etablissementId = profil?.etablissement_id
  if (!etablissementId) return { error: 'Établissement introuvable.' }

  const { data: seance } = await supabase
    .from('class_journal')
    .select('id, title, session_date, teacher_id, etablissement_id, classes:class_id(name), teachers:teacher_id(user_id)')
    .eq('id', id)
    .maybeSingle()

  if (!seance || seance.etablissement_id !== etablissementId) return { error: 'Séance introuvable.' }

  const estAuteur = (seance.teachers as any)?.user_id === user.id
  if (!ENCADREMENT.includes(role)) {
    if (!estAuteur) return { error: 'Seul son auteur peut supprimer cette séance.' }
    const jours = joursEcoules(seance.session_date)
    if (jours > FENETRE_SEANCE_JOURS) {
      return { error: `Cette séance date de plus de ${FENETRE_SEANCE_JOURS} jours : elle ne peut plus être supprimée.` }
    }
  }

  await logAudit(supabase, {
    action: 'DELETE',
    entityType: 'class_journal',
    entityId: id,
    description: `Seance supprimee : « ${seance.title} » · ${(seance.classes as any)?.name ?? ''} · du ${seance.session_date}`,
  })

  const { data: supprimes, error } = await supabase
    .from('class_journal')
    .delete()
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!supprimes || supprimes.length === 0) {
    return { error: 'Votre rôle ne permet pas de supprimer cette séance.' }
  }

  // Aucune notification : une séance est une CONSULTATION INTERNE, elle n'a
  // jamais rien envoyé aux familles (décision du 11 juillet). L'annuler ne leur
  // apprend donc rien qu'elles attendaient.
  revalidatePath('/dashboard/cahier-texte')
  return {}
}
