'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { pluriel } from '@/lib/texte/pluriel'
import { lireCleAdulte } from '@/lib/parents/participant'

const ROLES_AFFECTATION = ['admin', 'direction', 'responsable_pedagogique', 'secretaire'] as const

// ─── Diagnostic d'un retrait ──────────────────────────────────────────────────
// Un participant ne se retire pas tant qu'il reste des donnees sur le duo
// participant/classe (le declencheur de la base applique la meme regle). On compte
// ici CE QUI bloque, pour le dire : « des notes, absences ou bulletins existent »
// ne permettait pas de savoir quoi supprimer ni ou.
//
// Deux familles, traitees differemment :
//  - BLOQUANT : notes, absences/retards, bulletins archives. Donnees qu'on ne
//    supprime pas en passant : le retrait est refuse et le message detaille.
//  - APPRECIATIONS : texte saisi a la main, invisible hors de l'ecran Bulletins.
//    Le retrait demande une confirmation, puis les supprime avec l'inscription.
interface DiagRetrait {
  nom:           string
  notes:         number
  evaluations:   number
  absences:      number
  retards:       number
  archives:      string[] // libelles de periode
  appreciations: string[] // libelles de periode
}


function bloquants(d: DiagRetrait): string[] {
  const p: string[] = []
  if (d.notes > 0)           p.push(`${pluriel(d.notes, 'note')} sur ${pluriel(d.evaluations, 'évaluation')}`)
  if (d.absences > 0)        p.push(pluriel(d.absences, 'absence'))
  if (d.retards > 0)         p.push(pluriel(d.retards, 'retard'))
  if (d.archives.length > 0) p.push(`${pluriel(d.archives.length, 'bulletin archivé')} (${d.archives.join(', ')})`)
  return p
}

const estBloque = (d: DiagRetrait) => bloquants(d).length > 0

// Une NOTE REELLE : une note, une appreciation non vide ou « absent ». Meme regle
// que l'avancement de la saisie (`lib/dashboard/notes.ts`) et que les
// declencheurs `fn_block_*_unenroll` : une ligne vide (note effacee avant le
// 20/10) ne bloque pas un retrait.
const noteReelle = (r: { score: number | null; comment: string | null; is_absent: boolean | null }) =>
  r.score != null || !!(r.comment ?? '').trim() || !!r.is_absent

// Message de refus : un participant par segment, avec ce qui bloque.
function messageRefus(diags: DiagRetrait[]): string {
  return `Impossible de retirer : ${diags.map(d => `${d.nom} (${bloquants(d).join(', ')})`).join(' ; ')}.`
}

async function libellesPeriodes(supabase: Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  const map = new Map<string, string>()
  if (ids.length === 0) return map
  const { data } = await supabase.from('periods').select('id, label').in('id', ids)
  for (const p of (data ?? []) as any[]) map.set(p.id, p.label)
  return map
}

type Client = Awaited<ReturnType<typeof createClient>>

async function diagnostiquerEleves(supabase: Client, classId: string, ids: string[]): Promise<Map<string, DiagRetrait>> {
  const out = new Map<string, DiagRetrait>()
  if (ids.length === 0) return out

  const { data: st } = await supabase.from('students').select('id, last_name, first_name').in('id', ids)
  const noms = new Map((st ?? []).map((s: any) => [s.id, `${s.last_name} ${s.first_name}`]))
  const get = (id: string): DiagRetrait => {
    let d = out.get(id)
    if (!d) {
      d = { nom: noms.get(id) ?? id, notes: 0, evaluations: 0, absences: 0, retards: 0, archives: [], appreciations: [] }
      out.set(id, d)
    }
    return d
  }

  const { data: evals } = await supabase.from('evaluations').select('id').eq('class_id', classId)
  const evalIds = (evals ?? []).map((e: any) => e.id)
  if (evalIds.length > 0) {
    const { data } = await supabase.from('grades').select('student_id, evaluation_id, score, comment, is_absent').in('student_id', ids).in('evaluation_id', evalIds)
    const parEleve = new Map<string, Set<string>>()
    for (const r of (data ?? []) as any[]) {
      if (!noteReelle(r)) continue
      get(r.student_id).notes++
      if (!parEleve.has(r.student_id)) parEleve.set(r.student_id, new Set())
      parEleve.get(r.student_id)!.add(r.evaluation_id)
    }
    for (const [id, set] of parEleve) get(id).evaluations = set.size
  }

  const { data: abs } = await supabase.from('absences').select('student_id, absence_type').eq('class_id', classId).in('student_id', ids)
  for (const r of (abs ?? []) as any[]) {
    const d = get(r.student_id)
    if (r.absence_type === 'retard') d.retards++
    else d.absences++
  }

  const { data: appr } = await supabase.from('bulletin_appreciations').select('student_id, period_id').eq('class_id', classId).in('student_id', ids)
  const { data: arch } = await supabase.from('bulletin_archives').select('student_id, period_id').eq('class_id', classId).in('student_id', ids)
  const periodes = await libellesPeriodes(supabase, [...new Set([...(appr ?? []), ...(arch ?? [])].map((r: any) => r.period_id).filter(Boolean))])
  for (const r of (appr ?? []) as any[]) get(r.student_id).appreciations.push(periodes.get(r.period_id) ?? 'période inconnue')
  for (const r of (arch ?? []) as any[]) get(r.student_id).archives.push(periodes.get(r.period_id) ?? 'période inconnue')

  return out
}

async function diagnostiquerTuteurs(supabase: Client, classId: string, keys: string[]): Promise<Map<string, DiagRetrait>> {
  const out = new Map<string, DiagRetrait>()
  if (keys.length === 0) return out
  const wanted = new Set(keys)
  const parentIds = [...new Set(keys.map(k => lireCleAdulte(k).parent_id))]

  const { data: ps } = await supabase.from('parents')
    .select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name').in('id', parentIds)
  const pmap = new Map((ps ?? []).map((p: any) => [p.id, p]))
  const get = (k: string): DiagRetrait => {
    let d = out.get(k)
    if (!d) {
      const { parent_id, tutor_number } = lireCleAdulte(k)
      const p: any = pmap.get(parent_id)
      const nom = !p ? k : tutor_number === 2 ? `${p.tutor2_last_name} ${p.tutor2_first_name}` : `${p.tutor1_last_name} ${p.tutor1_first_name}`
      d = { nom, notes: 0, evaluations: 0, absences: 0, retards: 0, archives: [], appreciations: [] }
      out.set(k, d)
    }
    return d
  }
  const cle = (r: any) => `${r.parent_id}-${r.tutor_number}`

  const { data: evals } = await supabase.from('evaluations').select('id').eq('class_id', classId)
  const evalIds = (evals ?? []).map((e: any) => e.id)
  if (evalIds.length > 0) {
    const { data } = await supabase.from('adult_grades').select('parent_id, tutor_number, evaluation_id, score, comment, is_absent').in('parent_id', parentIds).in('evaluation_id', evalIds)
    const parTuteur = new Map<string, Set<string>>()
    for (const r of (data ?? []) as any[]) {
      const k = cle(r)
      if (!wanted.has(k) || !noteReelle(r)) continue
      get(k).notes++
      if (!parTuteur.has(k)) parTuteur.set(k, new Set())
      parTuteur.get(k)!.add(r.evaluation_id)
    }
    for (const [k, set] of parTuteur) get(k).evaluations = set.size
  }

  const { data: appr } = await supabase.from('adult_bulletin_appreciations').select('parent_id, tutor_number, period_id').eq('class_id', classId).in('parent_id', parentIds)
  const { data: arch } = await supabase.from('adult_bulletin_archives').select('parent_id, tutor_number, period_id').eq('class_id', classId).in('parent_id', parentIds)
  const periodes = await libellesPeriodes(supabase, [...new Set([...(appr ?? []), ...(arch ?? [])].map((r: any) => r.period_id).filter(Boolean))])
  for (const r of (appr ?? []) as any[]) if (wanted.has(cle(r))) get(cle(r)).appreciations.push(periodes.get(r.period_id) ?? 'période inconnue')
  for (const r of (arch ?? []) as any[]) if (wanted.has(cle(r))) get(cle(r)).archives.push(periodes.get(r.period_id) ?? 'période inconnue')

  return out
}

// Resultat d'un enregistrement : soit une erreur, soit une demande de confirmation
// (appreciations a supprimer avec le retrait), soit rien (succes).
export type ResultatAffectation = {
  error?: string
  confirmation?: { nom: string; periodes: string[] }[]
}

// Controle immediat au clic sur le retrait d'un eleve : ne refuse que le BLOQUANT.
// Les appreciations ne bloquent pas, elles se confirment a l'enregistrement.
export async function verifierRetraitEleve(classId: string, studentId: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer([...ROLES_AFFECTATION])
  if (roleError) return { error: roleError }
  const supabase = await createClient()
  const d = (await diagnostiquerEleves(supabase, classId, [studentId])).get(studentId)
  if (d && estBloque(d)) return { error: messageRefus([d]) }
  return {}
}

// Enregistre les affectations d'une classe (élèves) : retraits puis ajouts, tracés au journal.
// `supprimerAppreciations` : confirmation donnee pour supprimer les appreciations
// de bulletin des eleves retires (sans elle, la demande est renvoyee et rien n'est ecrit).
export async function saveStudentEnrollments(
  classId: string,
  toAdd: string[],
  toRemove: string[],
  supprimerAppreciations = false,
): Promise<ResultatAffectation> {
  const { error: roleError } = await requireRoleServer([...ROLES_AFFECTATION])
  if (roleError) return { error: roleError }
  if (!classId) return { error: 'Classe non spécifiée.' }

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Les retraits d'abord : on ne doit rien ecrire tant que le refus ou la
  // confirmation n'ont pas ete tranches (sinon les ajouts partiraient deux fois).
  if (toRemove.length > 0) {
    const diag = await diagnostiquerEleves(supabase, classId, toRemove)
    const bloques = [...diag.values()].filter(estBloque)
    if (bloques.length > 0) return { error: messageRefus(bloques) }

    const avecAppr = [...diag.entries()].filter(([, d]) => d.appreciations.length > 0)
    if (avecAppr.length > 0) {
      if (!supprimerAppreciations) {
        return { confirmation: avecAppr.map(([, d]) => ({ nom: d.nom, periodes: d.appreciations })) }
      }
      const echec = erreurEcriture(
        await supabase.from('bulletin_appreciations').delete().eq('class_id', classId).in('student_id', avecAppr.map(([id]) => id)).select('id'),
        'La suppression des appréciations',
      )
      if (echec) return { error: echec }
      await logAudit(supabase, {
        action:      'DELETE',
        entityType:  'bulletin_appreciations',
        entityId:    classId,
        description: `Appréciations supprimées au retrait de classe : ${avecAppr.map(([, d]) => `${d.nom} (${d.appreciations.join(', ')})`).join(' ; ')}.`,
      })
    }

    const echec = erreurEcriture(
      await supabase.from('enrollments').delete().eq('class_id', classId).in('student_id', toRemove).select('id'),
      'Ce retrait',
    )
    if (echec) return { error: echec }
  }

  if (toAdd.length > 0) {
    const rows = toAdd.map(student_id => ({
      student_id,
      class_id:        classId,
      status:          'active' as const,
      enrollment_date: today,
      // Un enfant parti puis reaffecte a la meme classe : la ligne `withdrawn`
      // redevient active, sa date de depart ne vaut plus.
      date_depart:     null,
    }))
    const { error } = await supabase.from('enrollments').upsert(rows, { onConflict: 'student_id,class_id' })
    if (error) return { error: "Erreur lors de l'ajout des inscriptions." }
  }

  if (toAdd.length + toRemove.length > 0) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
    await logAudit(supabase, {
      action:      'UPDATE',
      entityType:  'enrollments',
      entityId:    classId,
      description: `Affectation classe ${cls?.name ?? classId} : ${pluriel(toAdd.length, 'ajout')}, ${pluriel(toRemove.length, 'retrait')}.`,
    })
  }

  return {}
}

// ─── Affectation des adultes (tuteurs) ────────────────────────────────────────
// Les identifiants sont composites : `${parent_id}-${tutor_number}`. Table parent_class_enrollments.

export async function saveParentEnrollments(
  classId: string,
  toAdd: string[],
  toRemove: string[],
  supprimerAppreciations = false,
): Promise<ResultatAffectation> {
  const { error: roleError } = await requireRoleServer([...ROLES_AFFECTATION])
  if (roleError) return { error: roleError }
  if (!classId) return { error: 'Classe non spécifiée.' }

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  if (toRemove.length > 0) {
    // Meme regle que pour les eleves : bloquant detaille, appreciations confirmees.
    const diag = await diagnostiquerTuteurs(supabase, classId, toRemove)
    const bloques = [...diag.values()].filter(estBloque)
    if (bloques.length > 0) return { error: messageRefus(bloques) }

    const avecAppr = [...diag.entries()].filter(([, d]) => d.appreciations.length > 0)
    if (avecAppr.length > 0) {
      if (!supprimerAppreciations) {
        return { confirmation: avecAppr.map(([, d]) => ({ nom: d.nom, periodes: d.appreciations })) }
      }
      for (const [k] of avecAppr) {
        const { parent_id, tutor_number } = lireCleAdulte(k)
        const echec = erreurEcriture(
          await supabase.from('adult_bulletin_appreciations').delete()
            .eq('class_id', classId).eq('parent_id', parent_id).eq('tutor_number', tutor_number).select('id'),
          'La suppression des appréciations',
        )
        if (echec) return { error: echec }
      }
      await logAudit(supabase, {
        action:      'DELETE',
        entityType:  'adult_bulletin_appreciations',
        entityId:    classId,
        description: `Appréciations supprimées au retrait de classe : ${avecAppr.map(([, d]) => `${d.nom} (${d.appreciations.join(', ')})`).join(' ; ')}.`,
      })
    }

    for (const id of toRemove) {
      const { parent_id, tutor_number } = lireCleAdulte(id)
      const echec = erreurEcriture(
        await supabase
          .from('parent_class_enrollments')
          .delete()
          .eq('class_id', classId)
          .eq('parent_id', parent_id)
          .eq('tutor_number', tutor_number)
          .select('id'),
        'Ce retrait',
      )
      if (echec) return { error: echec }
    }
  }

  if (toAdd.length > 0) {
    const rows = toAdd.map(id => {
      const { parent_id, tutor_number } = lireCleAdulte(id)
      return { parent_id, class_id: classId, tutor_number, status: 'active' as const, enrollment_date: today, date_depart: null }
    })
    // `upsert` : un adulte parti puis reinscrit au meme cours reactive sa ligne
    // `withdrawn` (un simple ajout heurtait l'unicite parent/classe/tuteur).
    const { error } = await supabase.from('parent_class_enrollments').upsert(rows, { onConflict: 'parent_id,class_id,tutor_number' })
    if (error) return { error: "Erreur lors de l'ajout des inscriptions." }
  }

  if (toAdd.length + toRemove.length > 0) {
    const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
    await logAudit(supabase, {
      action:      'UPDATE',
      entityType:  'parent_class_enrollments',
      entityId:    classId,
      description: `Affectation cours adulte ${cls?.name ?? classId} : ${pluriel(toAdd.length, 'ajout')}, ${pluriel(toRemove.length, 'retrait')}.`,
    })
  }

  return {}
}
