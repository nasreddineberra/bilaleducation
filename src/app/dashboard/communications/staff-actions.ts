'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { sanitize } from '@/lib/security/sanitize'
import { logger } from '@/lib/logger'
import { sendNotificationEmail, hasSmtpConfig, type EmailAttachment } from '@/lib/email'
import type { UserRole } from '@/types/database'

// L'ENSEIGNANT est le seul role qui ne peut PAS ecrire au staff (il reste
// destinataire). Le comptable ecrit (paie / sujets comptables).
const STAFF_SEND_ROLES: UserRole[] = ['admin', 'direction', 'secretaire', 'responsable_pedagogique', 'comptable']

const BUCKET = 'communication-attachments'
const MAX_ATTACHMENTS_BYTES = 1024 * 1024   // 1 Mo, tous fichiers confondus
const SEND_BATCH_SIZE = 20

export type StaffChannel = 'email' | 'notification' | 'both'

export interface SendStaffMessagePayload {
  channel:      StaffChannel
  // Intention de ciblage : le serveur resout la liste reelle (jamais le client).
  group:        'all' | 'staff' | 'teachers' | null   // raccourcis
  roles:        string[]                                // par role
  profileIds:   string[]                                // individuel
  subject:      string
  bodyHtml:     string
  attachments?: { path: string; name: string; size: number }[]
}

export interface SendStaffMessageResult {
  error?:          string
  announcementId?: string
  recipients?:     number
  sent?:           number    // emails envoyes (0 si canal notification seul)
  failed?:         number
  notified?:       number    // destinataires notifies in-app
}

type StaffMember = { id: string; email: string | null; first_name: string; last_name: string; role: string }

export async function sendStaffMessage(payload: SendStaffMessagePayload): Promise<SendStaffMessageResult> {
  const { error: roleError } = await requireRoleServer(STAFF_SEND_ROLES)
  if (roleError) return { error: roleError }

  const subject  = payload.subject?.trim() ?? ''
  const bodyHtml = payload.bodyHtml?.trim() ?? ''
  if (!subject)  return { error: "L'objet est obligatoire." }
  if (!bodyHtml) return { error: 'Le message est obligatoire.' }

  const wantsEmail = payload.channel === 'email' || payload.channel === 'both'
  const wantsNotif = payload.channel === 'notification' || payload.channel === 'both'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, etablissement_id, email, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!profile?.etablissement_id) return { error: 'Établissement introuvable.' }

  // ─── Resolution des destinataires cote serveur (source unique) ─────────────
  // Staff pointables = actifs, ni parent ni super_admin, et jamais soi-meme.
  const { data: staff } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('etablissement_id', profile.etablissement_id)
    .eq('is_active', true)
    .neq('id', user.id)
    .not('role', 'in', '(parent,super_admin)')

  const staffList = (staff ?? []) as StaffMember[]

  const chosen = new Map<string, StaffMember>()
  const add = (m: StaffMember) => chosen.set(m.id, m)

  if (payload.group === 'all') {
    staffList.forEach(add)
  } else {
    if (payload.group === 'staff')    staffList.filter(m => m.role !== 'enseignant').forEach(add)
    if (payload.group === 'teachers') staffList.filter(m => m.role === 'enseignant').forEach(add)
    const roleSet = new Set(payload.roles ?? [])
    staffList.filter(m => roleSet.has(m.role)).forEach(add)
    const idSet = new Set(payload.profileIds ?? [])
    staffList.filter(m => idSet.has(m.id)).forEach(add)
  }

  const recipients = [...chosen.values()]
  if (recipients.length === 0) return { error: 'Aucun destinataire.' }

  // ─── Messagerie requise si un envoi email est demande ──────────────────────
  if (wantsEmail && !(await hasSmtpConfig(profile.etablissement_id))) {
    return { error: "Messagerie non configurée : impossible d'envoyer par email. Configurez-la dans Paramètres → Établissement, ou choisissez le canal Notification." }
  }

  const safeBody = sanitize(bodyHtml)

  // ─── Pieces jointes (plafond garde serveur, pas seulement dans l'UI) ───────
  const attachmentMeta = payload.attachments ?? []
  const totalBytes = attachmentMeta.reduce((sum, a) => sum + (a.size ?? 0), 0)
  if (totalBytes > MAX_ATTACHMENTS_BYTES) return { error: 'Les pièces jointes dépassent 1 Mo au total.' }

  const attachments: EmailAttachment[] = []
  if (wantsEmail) {
    for (const a of attachmentMeta) {
      const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(a.path)
      if (dlError || !blob) return { error: `Pièce jointe illisible : ${a.name}` }
      attachments.push({ filename: a.name, content: Buffer.from(await blob.arrayBuffer()) })
    }
  }

  // ─── Enregistrement (client session → le trigger d'audit capte l'acteur) ───
  const { data: announcement, error: annError } = await supabase
    .from('announcements')
    .insert({
      etablissement_id:  profile.etablissement_id,
      title:             subject,
      content:           safeBody,
      body_html:         safeBody,
      announcement_type: 'staff',
      channel:           payload.channel,
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
    logger.error('Communications staff : création du message impossible', annError)
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

  // Destinataires : toujours enregistres (trace + suivi). La visibilite in-app
  // depend du canal (l'inbox filtre channel = 'email').
  await supabase.from('announcement_staff_recipients').insert(
    recipients.map(r => ({
      announcement_id: announcement.id,
      profile_id:      r.id,
      email:           r.email,
      email_status:    wantsEmail ? 'pending' : 'skipped',
    }))
  )

  const notified = wantsNotif ? recipients.length : 0

  // ─── Envoi email ───────────────────────────────────────────────────────────
  let sent = 0
  let failed = 0

  if (wantsEmail) {
    // Direction en CCI (role direction seul, pas l'admin).
    const { data: directionProfiles } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'direction')
      .eq('is_active', true)
      .eq('etablissement_id', profile.etablissement_id)
    const bccAll = (directionProfiles ?? []).map(p => p.email).filter((e): e is string => !!e)

    // Message interne : NOM Prenom de l'auteur au pied, reponse a l'auteur.
    const senderName = `${profile.last_name ?? ''} ${profile.first_name ?? ''}`.trim()
    const replyTo = profile.email ?? undefined

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">${subject}</h2>
        <div style="color: #444; line-height: 1.6;">
          ${safeBody}
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">Message interne${senderName ? ` · ${senderName}` : ''}</p>
      </div>
    `

    for (let i = 0; i < recipients.length; i += SEND_BATCH_SIZE) {
      const batch = recipients.slice(i, i + SEND_BATCH_SIZE)
      const results = await Promise.all(
        batch.map(async r => {
          if (!r.email) return { r, status: 'skipped' as const }
          // Un envoi par destinataire (aucune adresse d'un collegue exposee).
          // On evite de remettre en CCI une adresse deja destinataire (doublon).
          const bcc = bccAll.filter(e => e !== r.email)
          const res = await sendNotificationEmail({
            etablissementId: profile.etablissement_id!,
            to:      [r.email],
            subject,
            html:    emailHtml,
            bcc,
            replyTo,
            attachments: attachments.length > 0 ? attachments : undefined,
          })
          return { r, status: res.success ? ('sent' as const) : ('failed' as const) }
        })
      )
      for (const { r, status } of results) {
        if (status === 'sent') sent++
        else if (status === 'failed') failed++
        await supabase
          .from('announcement_staff_recipients')
          .update({ email_status: status, sent_at: new Date().toISOString() })
          .eq('announcement_id', announcement.id)
          .eq('profile_id', r.id)
      }
    }
  }

  revalidatePath('/dashboard/communications')

  return { announcementId: announcement.id, recipients: recipients.length, sent, failed, notified }
}
