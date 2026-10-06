'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { effectiveRole } from '@/lib/auth/effective-role'
import { createNotification } from '@/lib/notifications'
import { marqueEcole } from '@/lib/email/marque-ecole'
import { coque, tableauInfos, POLICE, C } from '@/lib/email/shell.mjs'
import { formatJourLongFr } from '@/lib/dates'
import { sanitize } from '@/lib/security/sanitize'

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

type Dest = { parent_id: string; emailsOverride?: string[]; nom: string }

/**
 * Les foyers a prevenir pour un devoir, UN PAR FOYER.
 *
 * Extrait a son 2e usage (suppression, puis modification) : recopier une
 * resolution de destinataires, c est le motif qui a produit le calcul comptable
 * divergent dans trois sous-menus le 17 juillet.
 *
 * CLASSE ADULTE : les participants sont des TUTEURS (`parent_class_enrollments`),
 * et l on ecrit au seul tuteur inscrit — d ou `emailsOverride`. CLASSE ENFANTS :
 * un foyer peut avoir plusieurs enfants dans la classe, ses prenoms sont donc
 * reunis sur une seule ligne plutot que d envoyer deux fois le meme message.
 */
async function destinatairesDeLaClasse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  isAdult: boolean,
): Promise<Dest[]> {
  const destinataires: Dest[] = []

  if (isAdult) {
    const { data: participants } = await supabase
      .from('parent_class_enrollments')
      .select('parent_id, tutor_number, parents:parent_id(tutor1_email, tutor2_email, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name)')
      .eq('class_id', classId)
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
      .eq('class_id', classId)
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

  return destinataires
}


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

  // ── Destinataires résolus AVANT la suppression ──
  // La ligne va disparaître : ses foyers avec elle si on attend.
  const isAdult = !!(hw.classes as any)?.cotisation_types?.is_adult
  const destinataires = await destinatairesDeLaClasse(supabase, hw.class_id, isAdult)

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

/**
 * Modification d'un devoir — ALIGNEE SUR LA SUPPRESSION (arbitrage du 5 octobre).
 *
 * CE QUI MANQUAIT. La suppression avait sa fenêtre depuis le 24/09 ; la
 * modification, elle, écrivait `supabase.from('homework').update(...)`
 * DIRECTEMENT DEPUIS LE NAVIGATEUR, sans fenêtre, sans garde de rôle et sans
 * trace. On ne pouvait donc plus supprimer un devoir passé, mais on pouvait
 * encore le réécrire entièrement — ce qui revient au même, rien n'empêchant de
 * vider le titre et les consignes.
 *
 * Et griser le bouton n'aurait rien fermé : l'écriture partant du navigateur,
 * l'API REST serait restée ouverte. C'est la règle que ce projet a payée tout
 * l'été — un écran qui écrit depuis le navigateur n'est protégé que par la base
 * ou par une server action.
 *
 * LA FENETRE PORTE SUR LA DATE EN BASE, jamais sur celle du formulaire : sinon
 * il suffirait de poser une date future dans le même envoi pour se rouvrir le
 * droit de modifier un devoir ancien.
 */
export async function modifierDevoir(
  id: string,
  payload: {
    class_id: string
    teacher_id: string | null
    subject: string
    title: string
    description_html: string
    homework_type: string
    due_date: string
  },
): Promise<Resultat> {
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
    .select('id, title, due_date, description_html, homework_type, class_id, etablissement_id, classes:class_id(name, cotisation_types(is_adult)), teachers:teacher_id(user_id, civilite, first_name, last_name)')
    .eq('id', id)
    .maybeSingle()

  if (!hw || hw.etablissement_id !== etablissementId) return { error: 'Devoir introuvable.' }

  const estAuteur = (hw.teachers as { user_id?: string } | null)?.user_id === user.id
  if (!ENCADREMENT.includes(role)) {
    if (!estAuteur) return { error: 'Seul son auteur peut modifier ce devoir.' }
    if (joursEcoules(hw.due_date) > 0) {
      return { error: 'La date de rendu est passée : ce devoir appartient désormais à l’historique.' }
    }
  }

  const { data: modifies, error } = await supabase
    .from('homework')
    .update(payload)
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!modifies || modifies.length === 0) {
    return { error: 'Votre rôle ne permet pas de modifier ce devoir.' }
  }

  // La trace s'écrit APRES l'écriture, contrairement à la suppression : ici la
  // ligne ne disparaît pas, et une trace posée avant mentirait si l'écriture
  // était refusée par la RLS — un refus qui ne lève RIEN, il rend zéro ligne.
  await logAudit(supabase, {
    action: 'UPDATE',
    entityType: 'homework',
    entityId: id,
    description: `Devoir modifie : « ${payload.title} » · ${(hw.classes as { name?: string } | null)?.name ?? ''} · a rendre le ${payload.due_date}`,
  })

  revalidatePath('/dashboard/cahier-texte')

  // ── Prévenir les familles, mais SEULEMENT si ce qu'elles voient a changé ──
  //
  // Décision du 5 octobre. Notifier à chaque enregistrement ferait partir un
  // email à toute la classe pour une virgule corrigée — et une correction
  // reprise en trois fois en enverrait trois salves. On compare donc l'ancien
  // au nouveau sur les SEULS champs que la famille lit : titre, date de rendu,
  // consignes, type. Changer la matière ou l'enseignant rattaché ne les
  // concerne pas et n'envoie rien.
  //
  // La comparaison se fait sur `hw`, lu AVANT l'écriture — après, l'ancienne
  // valeur n'existe plus nulle part.
  const aChangeVisible =
    hw.title !== payload.title ||
    hw.due_date !== payload.due_date ||
    (hw.description_html ?? '') !== (payload.description_html ?? '') ||
    hw.homework_type !== payload.homework_type

  if (!aChangeVisible) return {}

  const isAdult = !!(hw.classes as { cotisation_types?: { is_adult?: boolean } } | null)?.cotisation_types?.is_adult
  const destinataires = await destinatairesDeLaClasse(supabase, hw.class_id, isAdult)

  const ecole = await marqueEcole(supabase, etablissementId)
  const t = hw.teachers as { civilite?: string; last_name?: string; first_name?: string } | null
  const teacherLabel = t
    ? `${t.civilite ? t.civilite + ' ' : ''}${t.last_name} ${t.first_name}`
    : ''
  let echecs = 0

  // Consignes sanitisées : voir la note de `route.ts` (notification de création).
  // La colonne porte du HTML de SAISIE, pas du HTML de confiance, et cet email
  // part à toutes les familles de la classe. Calculé une seule fois, la boucle
  // ci-dessous tournant une fois par FOYER.
  //
  // La comparaison `aChangeVisible` ci-dessus reste sur les valeurs BRUTES :
  // elle répond à « l'auteur a-t-il modifié le champ ? », pas à « le rendu
  // a-t-il changé ? ».
  const consignes = sanitize(payload.description_html)

  for (const d of destinataires) {
    const titre = d.nom ? `Devoir modifié · ${d.nom}` : 'Devoir modifié'
    const corps = `${payload.title} · ${(hw.classes as { name?: string } | null)?.name ?? ''}`

    // L'ÉTAT ACTUEL, sans comparaison (choix utilisateur) : le devoir tel qu'il
    // est désormais. Même tableau que les emails de création et d'annulation,
    // pour que les trois se lisent de la même façon.
    const html = coque({
      titre,
      apercu: corps,
      corps: [
        `              <div style="font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">Ce devoir a été modifié. Voici sa version à jour.</div>`,
        tableauInfos(([
          [isAdult ? 'Participant' : 'Élève', d.nom],
          ['Classe', (hw.classes as { name?: string } | null)?.name ?? ''],
          ['Titre', payload.title],
          ['À rendre le', formatJourLongFr(payload.due_date)],
          ['Enseignant', teacherLabel],
        ] as [string, string][]).filter(([, v]) => !!v)),
        // Valeur SANITISÉE testée, pas la brute : une consigne réduite à rien
        // par la sanitisation ne doit pas laisser un encadré bordé vide.
        consignes.trim()
          ? `              <div style="background:#faf8f6; border-left:3px solid ${C.bouton}; padding:14px 16px; border-radius:0 8px 8px 0; font-family:${POLICE}; font-size:14px; line-height:1.65; color:${C.encre};">${consignes}</div>`
          : '',
      ].filter(Boolean).join('\n'),
      ecole: { nom: ecole.nom, logoUrl: ecole.logoUrl },
    })

    const res = await createNotification({
      etablissement_id: etablissementId,
      type: 'homework',
      parent_id: d.parent_id,
      title: titre,
      body: corps,
      metadata: { homework_id: id, modifie: true },
      emailSubject: titre,
      emailHtml: html,
      ...(d.emailsOverride ? { emailsOverride: d.emailsOverride } : {}),
    })
    if (!res.ok) echecs++
  }

  // L'échec d'envoi ne défait pas la modification : elle a eu lieu, on le dit
  // (motif de l'alerte de changement d'email, 9 août).
  if (echecs > 0) {
    return { avertissement: `Devoir modifié. ${echecs} famille${echecs > 1 ? 's n’ont' : ' n’a'} pas pu être prévenue${echecs > 1 ? 's' : ''} par email.` }
  }
  return {}
}

/** Fenêtre de modification ET de suppression d'une séance, en jours. Même valeur
 *  que la fenêtre de préparation d'un remplaçant (13 juillet) : une seule notion
 *  de « récent » dans tout le module. */
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

/**
 * Modification d'une séance — même raisonnement que `modifierDevoir`.
 *
 * La fenêtre porte sur `session_date` TELLE QU'ELLE EST EN BASE. Déplacer la
 * séance vers une date plus ancienne dans le même envoi ne rouvre donc rien :
 * c'est l'état de départ qui décide du droit de modifier.
 */
export async function modifierSeance(
  id: string,
  payload: {
    class_id: string
    teacher_id: string | null
    subject: string | null
    session_date: string
    title: string
    content_html: string
  },
): Promise<Resultat> {
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
    .select('id, title, session_date, etablissement_id, classes:class_id(name), teachers:teacher_id(user_id)')
    .eq('id', id)
    .maybeSingle()

  if (!seance || seance.etablissement_id !== etablissementId) return { error: 'Séance introuvable.' }

  const estAuteur = (seance.teachers as { user_id?: string } | null)?.user_id === user.id
  if (!ENCADREMENT.includes(role)) {
    if (!estAuteur) return { error: 'Seul son auteur peut modifier cette séance.' }
    if (joursEcoules(seance.session_date) > FENETRE_SEANCE_JOURS) {
      return { error: `Cette séance date de plus de ${FENETRE_SEANCE_JOURS} jours : elle ne peut plus être modifiée.` }
    }
  }

  const { data: modifiees, error } = await supabase
    .from('class_journal')
    .update(payload)
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!modifiees || modifiees.length === 0) {
    return { error: 'Votre rôle ne permet pas de modifier cette séance.' }
  }

  await logAudit(supabase, {
    action: 'UPDATE',
    entityType: 'class_journal',
    entityId: id,
    description: `Seance modifiee : « ${payload.title} » · ${(seance.classes as { name?: string } | null)?.name ?? ''} · du ${payload.session_date}`,
  })

  revalidatePath('/dashboard/cahier-texte')
  return {}
}
