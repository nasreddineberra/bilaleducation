'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { alerterAncienneAdresse } from '@/lib/auth/email-change-alert'
import { phraseRefus } from '@/lib/financements/depart-refus'
import { headers } from 'next/headers'
import { messageDoublon } from '@/lib/doublons'
import { messageLimiteInscrits } from '@/lib/tenant/limite-inscrits'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'
import { classInfoOf } from '@/components/dashboard/classInfo'
import { CreateParentSchema, UpdateParentSchema, validateInput } from '@/lib/validation/schemas'
import { pluriel } from '@/lib/texte/pluriel'
import type { TablesInsert } from '@/types/supabase'

// ─── Payloads : les colonnes de `parents`, moins celles que pose le serveur ───

type ColonnesParent = Omit<TablesInsert<'parents'>,
  'id' | 'etablissement_id' | 'tutor1_user_id' | 'tutor2_user_id' | 'created_at' | 'updated_at'
  | 'tutor1_invite_le' | 'tutor2_invite_le' | 'tutor1_acces_configure_le' | 'tutor2_acces_configure_le'>

export type CreateParentPayload = ColonnesParent
// is_active est géré séparément — ne pas autoriser via ce endpoint
export type UpdateParentPayload = Partial<ColonnesParent>

// Champs interdits à l'injection
const FORBIDDEN_FIELDS = [
  'id', 'etablissement_id', 'tutor1_user_id', 'tutor2_user_id',
  'tutor1_invite_le', 'tutor2_invite_le', 'tutor1_acces_configure_le', 'tutor2_acces_configure_le',
  'created_at', 'updated_at', 'is_active', 'role',
]

const ALLOWED_FIELDS: (keyof CreateParentPayload)[] = [
  'tutor1_first_name', 'tutor1_last_name', 'tutor1_email', 'tutor1_phone',
  'tutor1_relationship', 'tutor1_address', 'tutor1_city', 'tutor1_postal_code',
  'tutor1_profession', 'tutor1_adult_courses',
  'tutor2_first_name', 'tutor2_last_name', 'tutor2_email', 'tutor2_phone',
  'tutor2_relationship', 'tutor2_address', 'tutor2_city', 'tutor2_postal_code',
  'tutor2_profession', 'tutor2_adult_courses',
  'situation_familiale', 'type_garde', 'notes',
]

/** Ne garde que les champs autorises ; leur forme a ete verifiee par zod en amont. */
function sanitizeParentPayload(payload: Record<string, unknown>): UpdateParentPayload {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_FIELDS.includes(key)) continue
    if ((ALLOWED_FIELDS as string[]).includes(key)) clean[key] = value
  }
  return clean as UpdateParentPayload
}

// ─── Créer une fiche parents ──────────────────────────────────────────────────
// Aucun compte de connexion ici : l'acces en ligne d'un tuteur passe par
// l'invitation a l'espace famille (Utilisateurs > Parents, `famille-actions.ts`),
// ou le parent choisit lui-meme son mot de passe.

export async function createParentRecord(payload: CreateParentPayload): Promise<{
  error?: string
  parentId?: string
}> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }

  // Validation côté serveur
  const validation = validateInput(CreateParentSchema, payload)
  if ('error' in validation) return { error: `Validation : ${validation.error}` }

  const headersList = await headers()
  const etablissementId = headersList.get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const cleanPayload = sanitizeParentPayload(payload) as CreateParentPayload
  const parentData: TablesInsert<'parents'> = { ...cleanPayload, etablissement_id: etablissementId }

  // Client SESSION : le trigger d'audit capte l'acteur (auth.uid()).
  const session = await createClient()
  const { data: parent, error: parentError } = await session
    .from('parents')
    .insert(parentData)
    .select('id')
    .single()

  if (parentError) {
    // Le declencheur d'unicite des tuteurs porte SON propre message, en
    // francais et nommant le foyer en conflit. Le remplacer par un texte
    // generique priverait l'utilisateur de la seule information qui lui
    // permet d'agir.
    return { error: messageDoublon(parentError) ?? messageLimiteInscrits(parentError) ?? 'Erreur lors de la création de la fiche parents.' }
  }

  return { parentId: parent.id }
}

// ─── Mettre à jour une fiche parents ─────────────────────────────────────────

export async function updateParentRecord(
  parentId: string,
  payload: UpdateParentPayload
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }

  // Validation côté serveur
  const validation = validateInput(UpdateParentSchema, payload)
  if ('error' in validation) return { error: `Validation : ${validation.error}` }

  // Client SESSION (pas admin) : le trigger d'audit capte l'acteur via auth.uid().
  // La policy « Admin, direction and secretaire can manage parents » (FOR ALL) l'autorise.
  const supabase = await createClient()

  // Sanitize payload pour empêcher l'injection de champs interdits
  const cleanPayload = sanitizeParentPayload(payload)

  // Garde : on ne peut pas DÉCOCHER « Inscrit aux cours adultes » d'un tuteur
  // encore inscrit a une classe adulte (retirer d'abord de la classe → qui a
  // elle-meme sa propre garde notes/bulletins). Coherence flag ↔ inscription.
  if (cleanPayload.tutor1_adult_courses === false || cleanPayload.tutor2_adult_courses === false) {
    const { data: current } = await supabase
      .from('parents').select('tutor1_adult_courses, tutor2_adult_courses').eq('id', parentId).single()
    const check: (1 | 2)[] = []
    if (current?.tutor1_adult_courses && cleanPayload.tutor1_adult_courses === false) check.push(1)
    if (current?.tutor2_adult_courses && cleanPayload.tutor2_adult_courses === false) check.push(2)
    if (check.length > 0) {
      const { data: enr } = await supabase
        .from('parent_class_enrollments')
        .select('tutor_number, classes!inner(cotisation_types:cotisation_type_id(is_adult))')
        .eq('parent_id', parentId).eq('status', 'active').in('tutor_number', check)
      const stillEnrolled = (enr ?? []).some(r => r.classes.cotisation_types?.is_adult)
      if (stillEnrolled) {
        return { error: 'Ce tuteur est inscrit à un cours adulte. Retirez-le d’abord de la classe avant de décocher « Inscrit aux cours adultes ».' }
      }
    }
  }

  // Compte en ligne d'un tuteur dont l'email change : son adresse de connexion
  // suit (espace famille, docs/ESPACE-FAMILLE.md). Le compte d'abord : si la
  // nouvelle adresse est deja prise, la fiche n'est pas modifiee.
  const changements = await emailsComptesAChanger(supabase, parentId, cleanPayload)
  if ('error' in changements) return changements
  const admin = createAdminClient()
  for (const c of changements) {
    const { error } = await admin.auth.admin.updateUserById(c.compte, { email: c.nouvelle, email_confirm: true })
    if (error) {
      for (const fait of changements.slice(0, changements.indexOf(c))) {
        await admin.auth.admin.updateUserById(fait.compte, { email: fait.ancienne, email_confirm: true })
      }
      return { error: /already|registered|exists/i.test(error.message)
        ? `L’adresse ${c.nouvelle} est déjà utilisée par un autre compte.`
        : 'L’adresse du compte en ligne n’a pas pu être modifiée.' }
    }
  }

  const resMaj = await supabase
    .from('parents')
    .update(cleanPayload)
    .eq('id', parentId)
    .select('id')

  // Meme raison qu'a la creation : renommer un tuteur peut le faire entrer en
  // conflit avec un autre foyer, et c'est le declencheur qui le dit le mieux.
  const echecMaj = resMaj.error
    ? messageDoublon(resMaj.error) ?? messageLimiteInscrits(resMaj.error) ?? resMaj.error.message
    : erreurEcriture(resMaj, 'Ce foyer')
  if (echecMaj) {
    for (const c of changements) await admin.auth.admin.updateUserById(c.compte, { email: c.ancienne, email_confirm: true })
    return { error: echecMaj }
  }

  // Profil (miroir de l'adresse du compte, client admin : le profil d'un parent
  // n'est pas modifiable par la secretaire) et alerte a l'ancienne adresse.
  const etablissementId = (await headers()).get('x-etablissement-id')
  for (const c of changements) {
    const { error } = await admin.from('profiles').update({ email: c.nouvelle }).eq('id', c.compte).select('id')
    if (error) console.error('[updateParentRecord] email du profil non mis a jour :', error.message)
    if (etablissementId) {
      await alerterAncienneAdresse({ etablissementId, ancienneAdresse: c.ancienne, nouvelleAdresse: c.nouvelle, parUnAdministrateur: true })
        .catch(() => { /* non bloquant */ })
    }
  }
  return {}
}

/** Comptes en ligne des tuteurs dont l'email change (nouvelle adresse non vide). */
async function emailsComptesAChanger(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parentId: string,
  payload: UpdateParentPayload,
): Promise<{ compte: string; ancienne: string; nouvelle: string }[] | { error: string }> {
  if (payload.tutor1_email === undefined && payload.tutor2_email === undefined) return []
  const { data: actuel } = await supabase
    .from('parents')
    .select('tutor1_user_id, tutor2_user_id')
    .eq('id', parentId)
    .maybeSingle()
  if (!actuel) return { error: 'Foyer introuvable.' }
  const changements: { compte: string; ancienne: string; nouvelle: string }[] = []
  const admin = createAdminClient()
  for (const [compte, saisie] of [[actuel.tutor1_user_id, payload.tutor1_email], [actuel.tutor2_user_id, payload.tutor2_email]] as const) {
    const nouvelle = saisie?.trim().toLowerCase()
    if (!compte || !nouvelle) continue
    const { data } = await admin.auth.admin.getUserById(compte)
    const ancienne = data?.user?.email ?? ''
    if (ancienne.toLowerCase() !== nouvelle) changements.push({ compte, ancienne, nouvelle })
  }
  return changements
}

// ─── Mise à jour en lot des inscriptions « cours adultes » (une famille/ligne) ──

export interface ParentAdultRow {
  id:              string
  tutor1Name:      string
  tutor1Adult:     boolean
  tutor1Locked:    boolean          // inscrit à une classe adulte → non modifiable
  tutor1ClassInfo: string | null    // libellé de la classe adulte (tooltip)
  tutor2Name:      string | null
  tutor2Adult:     boolean
  tutor2Locked:    boolean
  tutor2ClassInfo: string | null
}

/** Map `parentId-tutorNumber` → infos de la classe ADULTE où le tuteur est inscrit
 *  (verrouillé). Le libellé sert de tooltip (nom de classe + infos standard). */
async function adultEnrolledMap(supabase: Awaited<ReturnType<typeof createClient>>): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('parent_class_enrollments')
    .select('parent_id, tutor_number, classes!inner(name, level, day_of_week, start_time, end_time, cotisation_types:cotisation_type_id(label, is_adult), class_teachers(is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name)))')
    .eq('status', 'active')
  const m = new Map<string, string>()
  for (const r of data ?? []) {
    if (!r.classes.cotisation_types?.is_adult) continue
    const info = [r.classes.name, classInfoOf(r.classes)].filter(Boolean).join(' · ')
    m.set(`${r.parent_id}-${r.tutor_number}`, info)
  }
  return m
}

export async function getParentsForAdultModal(): Promise<{ error?: string; families?: ParentAdultRow[] }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }
  const supabase = await createClient()

  const [{ data: parents }, enrolled] = await Promise.all([
    supabase.from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor1_adult_courses, tutor2_last_name, tutor2_first_name, tutor2_adult_courses')
      .order('tutor1_last_name').order('tutor1_first_name'),
    adultEnrolledMap(supabase),
  ])

  const families: ParentAdultRow[] = (parents ?? []).map((p): ParentAdultRow => ({
    id:              p.id,
    tutor1Name:      `${p.tutor1_last_name ?? ''} ${p.tutor1_first_name ?? ''}`.trim(),
    tutor1Adult:     !!p.tutor1_adult_courses,
    tutor1Locked:    enrolled.has(`${p.id}-1`),
    tutor1ClassInfo: enrolled.get(`${p.id}-1`) ?? null,
    tutor2Name:      p.tutor2_last_name ? `${p.tutor2_last_name} ${p.tutor2_first_name ?? ''}`.trim() : null,
    tutor2Adult:     !!p.tutor2_adult_courses,
    tutor2Locked:    enrolled.has(`${p.id}-2`),
    tutor2ClassInfo: enrolled.get(`${p.id}-2`) ?? null,
  }))

  return { families }
}

/** Enregistre les cases « cours adultes » modifiées. Garde : on ne peut pas
 *  décocher un tuteur inscrit à une classe adulte (forcé à true par sécurité). */
export async function saveParentsAdultCourses(
  updates: { id: string; tutor1_adult_courses: boolean; tutor2_adult_courses: boolean }[],
): Promise<{ error?: string; updated?: number }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }
  if (!updates || updates.length === 0) return { updated: 0 }

  const supabase = await createClient()
  const enrolled = await adultEnrolledMap(supabase)

  let updated = 0
  for (const u of updates) {
    const t1 = u.tutor1_adult_courses === false && enrolled.has(`${u.id}-1`) ? true : u.tutor1_adult_courses
    const t2 = u.tutor2_adult_courses === false && enrolled.has(`${u.id}-2`) ? true : u.tutor2_adult_courses
    const echec = erreurEcriture(
      await supabase
        .from('parents')
        .update({ tutor1_adult_courses: t1, tutor2_adult_courses: t2 })
        .eq('id', u.id)
        .select('id'),
      'Cette inscription aux cours adultes',
    )
    if (echec) return { error: echec }
    updated++
  }

  try {
    await logAudit(supabase, {
      action: 'UPDATE', entityType: 'parents',
      description: `Mise à jour en lot des inscriptions cours adultes : ${pluriel(updated, 'famille')}.`,
    })
  } catch { /* non bloquant */ }

  return { updated }
}

// ─── Suppression d'un foyer ────────────────────────────────────────────────
//
// DOCTRINE STRICTE (arbitrage du 13 septembre) : on ne supprime qu'une fiche
// VIERGE. Contrairement a l'apprenant, il n'y a PAS de repli « rendre
// inactif » — `parents` ne porte pas de colonne `is_active`, et l'ajouter
// deborderait largement (listes, filtres, import, affectations adultes).
// Le refus dit donc quoi retirer.
//
// La garantie vit dans le declencheur `trg_guard_parent_delete` ; cette liste
// ne sert qu'a EXPLIQUER avant le clic.
export async function getParentDeleteDeps(id: string): Promise<{
  enfants:        number
  finance:        number
  coursAdultes:   number
  communications: number
  erreur?:        string
}> {
  // Garde absente jusqu'au 29/09 : n'importe quel compte connecte pouvait
  // appeler cette action et connaitre le nombre de cotisations d'un foyer.
  // Meme perimetre que la suppression qu'elle prepare.
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { enfants: 0, finance: 0, coursAdultes: 0, communications: 0, erreur: 'Non autorise.' }

  const supabase = await createClient()
  const head = { count: 'exact' as const, head: true }

  const r = await Promise.all([
    supabase.from('students').select('id', head).eq('parent_id', id),
    supabase.from('family_fees').select('id', head).eq('parent_id', id),
    supabase.from('financement_communications').select('id', head).eq('parent_id', id),
    supabase.from('parent_class_enrollments').select('id', head).eq('parent_id', id),
    supabase.from('adult_grades').select('id', head).eq('parent_id', id),
    supabase.from('adult_absences').select('id', head).eq('parent_id', id),
    supabase.from('adult_bulletin_archives').select('id', head).eq('parent_id', id),
    supabase.from('adult_bulletin_appreciations').select('id', head).eq('parent_id', id),
    supabase.from('adult_homework_status').select('id', head).eq('parent_id', id),
    supabase.from('announcement_recipients').select('id', head).eq('parent_id', id),
    supabase.from('notifications').select('id', head).eq('parent_id', id),
  ])

  // PIEGE POSTGREST : sur un comptage `head`, une requete impossible repond
  // 204 avec `count: null` ET `error: null`. Un `?? 0` ferait donc d'une panne
  // un feu vert pour supprimer. Le signal est `count === null`.
  if (r.some(x => x.count === null)) {
    return {
      enfants: 0, finance: 0, coursAdultes: 0, communications: 0,
      erreur: 'Impossible de vérifier les données rattachées à ce foyer.',
    }
  }

  const [enfants, fees, finComm, inscrAd, gradesAd, absAd, bullAd, apprAd, hwAd, annonces, notifs] = r
  const n = (x: { count: number | null }) => x.count ?? 0

  return {
    enfants:        n(enfants),
    finance:        n(fees) + n(finComm),
    coursAdultes:   n(inscrAd) + n(gradesAd) + n(absAd) + n(bullAd) + n(apprAd) + n(hwAd),
    communications: n(annonces) + n(notifs),
  }
}

export async function deleteParent(id: string): Promise<{ error?: string }> {
  // Restreint a admin/direction le 29/09, en meme temps que la RLS du lot 1 :
  // decider si un foyer est supprimable exige de COMPTER ses cotisations, et
  // `family_fees` devient reservee aux roles finance. Plutot qu'ouvrir la
  // lecture des montants dus a deux roles de plus, on resserre l'acte — il est
  // lourd, et un foyer avec des cotisations est de toute facon bloque.
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: cible } = await supabase
    .from('parents')
    .select('tutor1_last_name, tutor1_first_name, tutor1_email')
    .eq('id', id)
    .maybeSingle()
  if (!cible) return { error: 'Foyer introuvable.' }
  // Lus a part : `cible` part tel quel dans le journal d'activite.
  const { data: comptesTuteurs } = await supabase
    .from('parents').select('tutor1_user_id, tutor2_user_id').eq('id', id).maybeSingle()

  const deps = await getParentDeleteDeps(id)
  if (deps.erreur) return { error: deps.erreur }
  if (deps.enfants + deps.finance + deps.coursAdultes + deps.communications > 0) {
    return { error: 'Des données sont rattachées à ce foyer : il ne peut pas être supprimé.' }
  }

  // Tracer AVANT d'effacer.
  await logAudit(supabase, {
    action:      'DELETE',
    entityType:  'parents',
    entityId:    id,
    description: `Suppression du foyer ${cible.tutor1_last_name} ${cible.tutor1_first_name}`,
    oldData:     cible,
  })

  // `.select()` : une suppression écartée par la RLS ne lève pas d'erreur,
  // elle supprime zéro ligne.
  const { data: supprimes, error } = await supabase
    .from('parents').delete().eq('id', id).select('id')

  if (error) return { error: 'Erreur lors de la suppression du foyer.' }
  if (!supprimes || supprimes.length === 0) {
    return { error: 'La suppression n\'a pas été autorisée.' }
  }

  // Comptes en ligne des tuteurs (espace famille) : supprimes avec le foyer, le
  // profil part avec le compte (cle etrangere en cascade). Sans cela ils
  // restaient orphelins. L'echec est RENDU : la fiche est deja supprimee.
  const comptes = [comptesTuteurs?.tutor1_user_id, comptesTuteurs?.tutor2_user_id].filter((c): c is string => !!c)
  for (const compte of comptes) {
    const { error: errAuth } = await createAdminClient().auth.admin.deleteUser(compte)
    if (errAuth) {
      console.error('[deleteParent] compte en ligne non supprime :', errAuth.message)
      return { error: `Le foyer est supprimé, mais un compte en ligne n'a pas pu l'être : ${errAuth.message}` }
    }
  }
  return {}
}

// Depart en cours d'annee d'un tuteur (cours adulte). Une seule transaction en
// base (`declarer_depart_adulte`) : inscription en `withdrawn` avec sa date,
// mouvement trace. La RPC refuse un tuteur SANS donnees (son retrait se fait
// dans Affectations) et une date hors de l'annee.
export async function declarerDepartAdulte(
  parentId: string, tutorNumber: 1 | 2, classId: string, date: string,
): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction', 'responsable_pedagogique', 'secretaire'])
  if (roleError) return { error: roleError }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Date de départ invalide.' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('declarer_depart_adulte', {
    p_parent_id: parentId, p_tutor_number: tutorNumber, p_class_id: classId, p_date: date,
  })
  if (error) return { error: phraseRefus(error, 'Le départ n’a pas pu être enregistré.') }
  return {}
}
