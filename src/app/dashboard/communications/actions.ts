'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { createNotification } from '@/lib/notifications'
import { sanitize } from '@/lib/security/sanitize'
import { logger } from '@/lib/logger'
import type { EmailAttachment } from '@/lib/email'
import type { UserRole } from '@/types/database'

// ─── Perimetre ───────────────────────────────────────────────────────────────
// La communication aux parents est la voix de l'etablissement :
//   - l'enseignant ne communique que les devoirs (cahier de texte) ;
//   - le comptable communique par Financements (transactionnel : recu, relance).
const PARENT_COMM_ROLES: UserRole[] = ['admin', 'direction', 'secretaire', 'responsable_pedagogique']

// « Tous les parents enregistres » est le seul mode qui atteint les non-inscrits
// (anciennes familles, prospects) : plus restreint que le reste.
const ALL_REGISTERED_ROLES: UserRole[] = ['admin', 'direction', 'secretaire']

const BUCKET = 'communication-attachments'
const MAX_ATTACHMENTS_BYTES = 1024 * 1024   // 1 Mo, tous fichiers confondus
const SEND_BATCH_SIZE = 20

export type ParentTargetType = 'all_active' | 'all_registered' | 'class' | 'selected'

export interface SendParentMessagePayload {
  targetType:   ParentTargetType
  classId?:     string | null
  parentIds?:   string[]
  subject:      string
  bodyHtml:     string
  attachments?: { path: string; name: string; size: number }[]
}

export interface SendParentMessageResult {
  error?:          string
  announcementId?: string
  households?:     number   // foyers cibles
  sent?:           number
  failed?:         number
  withoutEmail?:   number
}

/** Un foyer destinataire et les adresses a servir pour lui. */
type Recipient = { parentId: string; emails: string[] }

// ─── Resolution des destinataires (source unique, cote serveur) ──────────────
// Toute la resolution vit ici : le client ne fait que proposer une cible, il ne
// decide jamais qui recoit. C'est ce qui permet de garder les regles vraies.

type ParentEmailRow = {
  id: string
  tutor1_email: string | null
  tutor2_email: string | null
}

function householdEmails(p: ParentEmailRow): string[] {
  return [p.tutor1_email, p.tutor2_email].filter((e): e is string => !!e)
}

/**
 * Parents « inscrits » cette annee : ceux dont un enfant est inscrit dans une
 * classe de l'annee, PLUS les adultes inscrits eux-memes a un cours adulte.
 * Sert a `all_active` et a borner le vivier de `selected`.
 */
async function getEnrolledParentIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  yearLabel: string | null,
): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!yearLabel) return ids

  const { data: yearClasses } = await supabase
    .from('classes')
    .select('id')
    .eq('academic_year', yearLabel)

  const classIds = (yearClasses ?? []).map(c => c.id)
  if (classIds.length === 0) return ids

  // Enfants inscrits
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('students(parent_id)')
    .in('class_id', classIds)
    .eq('status', 'active')

  for (const e of ((enrollments ?? []) as any[])) {
    const pid = e.students?.parent_id
    if (pid) ids.add(pid)
  }

  // Adultes inscrits a un cours adulte (ils ne sont pas des `students`)
  const { data: adultEnrollments } = await supabase
    .from('parent_class_enrollments')
    .select('parent_id')
    .in('class_id', classIds)
    .eq('status', 'active')

  for (const a of ((adultEnrollments ?? []) as any[])) {
    if (a.parent_id) ids.add(a.parent_id)
  }

  return ids
}

/** Destinataires d'une classe. Une classe adulte n'a pas d'eleves : ses
 *  participants sont les tuteurs inscrits, et seul le tuteur inscrit est servi. */
async function resolveClassRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
): Promise<Recipient[]> {
  const { data: cls } = await supabase
    .from('classes')
    .select('id, cotisation_types(is_adult)')
    .eq('id', classId)
    .single()

  const isAdult = !!(cls as any)?.cotisation_types?.is_adult

  if (isAdult) {
    const { data: rows } = await supabase
      .from('parent_class_enrollments')
      .select('parent_id, tutor_number, parents:parent_id(id, tutor1_email, tutor2_email)')
      .eq('class_id', classId)
      .eq('status', 'active')

    return ((rows ?? []) as any[])
      .filter(r => r.parents)
      .map(r => {
        // Le message concerne le cours de CE tuteur : on ne sert que son adresse.
        const email = r.tutor_number === 1 ? r.parents.tutor1_email : r.parents.tutor2_email
        return { parentId: r.parent_id, emails: [email].filter(Boolean) as string[] }
      })
  }

  const { data: rows } = await supabase
    .from('enrollments')
    .select('students(parent_id, parents:parent_id(id, tutor1_email, tutor2_email))')
    .eq('class_id', classId)
    .eq('status', 'active')

  const map = new Map<string, Recipient>()
  for (const r of ((rows ?? []) as any[])) {
    const parent = r.students?.parents
    if (!parent) continue
    map.set(parent.id, { parentId: parent.id, emails: householdEmails(parent) })
  }
  return [...map.values()]
}

async function resolveRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  payload: SendParentMessagePayload,
  yearLabel: string | null,
): Promise<{ recipients: Recipient[]; error?: string }> {
  const { targetType, classId, parentIds } = payload

  if (targetType === 'class') {
    if (!classId) return { recipients: [], error: 'Aucune classe sélectionnée.' }
    return { recipients: await resolveClassRecipients(supabase, classId) }
  }

  let ids: string[]

  if (targetType === 'all_registered') {
    // Toute la base (RLS = etablissement courant)
    const { data } = await supabase.from('parents').select('id')
    ids = (data ?? []).map(p => p.id)
  } else if (targetType === 'all_active') {
    ids = [...await getEnrolledParentIds(supabase, yearLabel)]
  } else {
    // selected : on ne fait pas confiance a la liste du client. « Parents
    // choisis » cible les parents d'eleves inscrits — on borne au vivier reel.
    const enrolled = await getEnrolledParentIds(supabase, yearLabel)
    ids = (parentIds ?? []).filter(id => enrolled.has(id))
    if (ids.length === 0) return { recipients: [], error: 'Aucun parent inscrit dans la sélection.' }
  }

  if (ids.length === 0) return { recipients: [] }

  const { data: parents } = await supabase
    .from('parents')
    .select('id, tutor1_email, tutor2_email')
    .in('id', ids)

  return {
    recipients: ((parents ?? []) as ParentEmailRow[]).map(p => ({
      parentId: p.id,
      emails:   householdEmails(p),
    })),
  }
}

// ─── Envoi ───────────────────────────────────────────────────────────────────

export async function sendParentMessage(
  payload: SendParentMessagePayload,
): Promise<SendParentMessageResult> {
  const { error: roleError } = await requireRoleServer(PARENT_COMM_ROLES)
  if (roleError) return { error: roleError }

  const subject  = payload.subject?.trim() ?? ''
  const bodyHtml = payload.bodyHtml?.trim() ?? ''
  if (!subject)  return { error: "L'objet est obligatoire." }
  if (!bodyHtml) return { error: 'Le message est obligatoire.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, etablissement_id, email, first_name, last_name, civilite')
    .eq('id', user.id)
    .single()

  if (!profile?.etablissement_id) return { error: 'Établissement introuvable.' }
  const role = profile.role as UserRole

  if (payload.targetType === 'all_registered' && !ALL_REGISTERED_ROLES.includes(role)) {
    return { error: "Votre rôle ne permet pas d'écrire à tous les parents enregistrés." }
  }

  const { data: etablissement } = await supabase
    .from('etablissements')
    .select('nom, contact')
    .eq('id', profile.etablissement_id)
    .single()

  // Le parent repond a l'ecole, jamais a l'auteur : un membre du staff part,
  // l'adresse reste. Sans adresse de contact, une reponse partirait vers
  // l'adresse d'envoi (un noreply) et serait perdue → on bloque en amont,
  // avant d'enregistrer quoi que ce soit.
  const replyTo = etablissement?.contact?.trim()
  if (!replyTo) {
    return { error: "Aucune adresse de contact n'est renseignée pour l'établissement : les parents ne pourraient pas répondre. Renseignez-la dans Paramètres → Établissement." }
  }

  // Le corps vient d'un editeur riche : on assainit AVANT de stocker et d'envoyer,
  // et non plus seulement pour l'apercu.
  const safeBody = sanitize(bodyHtml)

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('is_current', true)
    .single()

  const { recipients, error: resolveError } = await resolveRecipients(supabase, payload, schoolYear?.label ?? null)
  if (resolveError) return { error: resolveError }
  if (recipients.length === 0) return { error: 'Aucun destinataire pour cette cible.' }

  // ─── Pieces jointes : plafond garde cote serveur, pas seulement dans l'UI ──
  const attachmentMeta = payload.attachments ?? []
  const totalBytes = attachmentMeta.reduce((sum, a) => sum + (a.size ?? 0), 0)
  if (totalBytes > MAX_ATTACHMENTS_BYTES) {
    return { error: 'Les pièces jointes dépassent 1 Mo au total.' }
  }

  const attachments: EmailAttachment[] = []
  for (const a of attachmentMeta) {
    const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(a.path)
    if (dlError || !blob) return { error: `Pièce jointe illisible : ${a.name}` }
    attachments.push({ filename: a.name, content: Buffer.from(await blob.arrayBuffer()) })
  }

  // ─── Enregistrement (client session → le trigger d'audit capte l'acteur) ──
  const { data: announcement, error: annError } = await supabase
    .from('announcements')
    .insert({
      etablissement_id:  profile.etablissement_id,
      title:             subject,
      content:           safeBody,
      body_html:         safeBody,
      announcement_type: payload.targetType,
      target_class_id:   payload.targetType === 'class' ? payload.classId : null,
      channel:           'email',   // les parents n'ont pas de compte en V1
      sender_email:      profile.email,
      published_by:      user.id,
      is_published:      true,
      published_at:      new Date().toISOString(),
      sent_at:           new Date().toISOString(),
      recipient_count:   recipients.length,
    })
    .select('id')
    .single()

  if (annError || !announcement) {
    logger.error('Communications : création du message impossible', annError)
    return { error: "Le message n'a pas pu être enregistré." }
  }

  if (attachmentMeta.length > 0) {
    await supabase.from('announcement_attachments').insert(
      attachmentMeta.map(a => ({
        announcement_id: announcement.id,
        file_path:       a.path,
        file_name:       a.name,
        file_size:       a.size,
      }))
    )
  }

  await supabase.from('announcement_recipients').insert(
    recipients.map(r => ({
      announcement_id: announcement.id,
      parent_id:       r.parentId,
      email:           r.emails.join(', '),
      email_status:    r.emails.length > 0 ? 'pending' : 'skipped',
    }))
  )

  // ─── Direction en CCI, systematiquement ──────────────────────────────────
  // Le role `admin` est technique : « ecrire a la direction » ne l'inclut pas.
  const { data: directionProfiles } = await supabase
    .from('profiles')
    .select('email')
    .eq('role', 'direction')
    .eq('is_active', true)
    .eq('etablissement_id', profile.etablissement_id)

  const bcc = (directionProfiles ?? []).map(p => p.email).filter((e): e is string => !!e)

  const etabName = etablissement?.nom ?? 'Votre établissement'
  const senderName = `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${subject}</h2>
      <div style="color: #444; line-height: 1.6;">
        ${safeBody}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">
        ${etabName}${senderName ? ` · ${senderName}` : ''}
      </p>
    </div>
  `

  // ─── Envoi, par lots ─────────────────────────────────────────────────────
  let sent = 0
  let failed = 0
  let withoutEmail = 0

  for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
    const batch = recipients.slice(i, i + SEND_BATCH_SIZE)

    const results = await Promise.all(
      batch.map(async r => {
        // Foyer sans adresse connue : on cree quand meme la notification (archive
        // visible le jour ou les comptes parents seront actives), sans email.
        const result = await createNotification({
          etablissement_id: profile.etablissement_id!,
          type:             'announcement',
          parent_id:        r.parentId,
          title:            subject,
          body:             subject,
          metadata:         { announcement_id: announcement.id },
          emailSubject:     subject,
          emailHtml,
          emailsOverride:   r.emails,
          emailBcc:         r.emails.length > 0 ? bcc : undefined,
          emailReplyTo:     replyTo,
          emailAttachments: attachments.length > 0 ? attachments : undefined,
        })
        return { recipient: r, result }
      })
    )

    for (const { recipient, result } of results) {
      let status: 'sent' | 'failed' | 'skipped'
      if (recipient.emails.length === 0) {
        status = 'skipped'
        withoutEmail++
      } else if (result.emailStatus === 'sent') {
        status = 'sent'
        sent++
      } else {
        status = 'failed'
        failed++
      }

      await supabase
        .from('announcement_recipients')
        .update({ email_status: status, sent_at: new Date().toISOString() })
        .eq('announcement_id', announcement.id)
        .eq('parent_id', recipient.parentId)
    }
  }

  revalidatePath('/dashboard/communications')

  return {
    announcementId: announcement.id,
    households:     recipients.length,
    sent,
    failed,
    withoutEmail,
  }
}
