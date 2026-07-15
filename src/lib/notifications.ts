import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail, type EmailAttachment } from '@/lib/email'
import { sendPushToUser } from '@/lib/push'

interface CreateNotificationParams {
  etablissement_id: string
  type: 'absence' | 'retard' | 'payment' | 'announcement' | 'homework'
  parent_id: string
  student_id?: string | null
  title: string
  body: string
  metadata?: Record<string, any>
  emailHtml?: string
  emailSubject?: string
  // Force la liste des destinataires email (ex. classe adulte : uniquement le
  // tuteur inscrit). Si absent, on envoie aux emails du foyer (getEmails).
  emailsOverride?: string[]
  // Copie carbone invisible (ex. la direction, systematiquement en CCI des
  // communications aux parents).
  emailBcc?: string[]
  // Adresse de reponse : sans elle le parent repond a un noreply.
  emailReplyTo?: string
  emailAttachments?: EmailAttachment[]
}

export interface NotificationResult {
  ok: boolean
  emailStatus: 'sent' | 'failed' | 'skipped'
  pushStatus: 'sent' | 'failed' | 'no_sub'
  error?: string
}

interface ParentInfo {
  id: string
  user_id: string | null
  tutor1_first_name: string | null
  tutor1_last_name: string | null
  tutor1_email: string | null
  tutor2_email: string | null
}

/**
 * Crée une notification, envoie l'email et le push.
 *
 * Retourne le sort reel de l'envoi : les appelants qui doivent rendre compte a
 * l'utilisateur (communications) s'en servent pour compter les echecs, ceux qui
 * notifient en arriere-plan peuvent l'ignorer.
 */
export async function createNotification(params: CreateNotificationParams): Promise<NotificationResult> {
  const supabase = createAdminClient()

  // 1. Insert notification
  const { data: notif, error } = await supabase
    .from('notifications')
    .insert({
      etablissement_id: params.etablissement_id,
      type: params.type,
      parent_id: params.parent_id,
      student_id: params.student_id ?? null,
      title: params.title,
      body: params.body,
      metadata: params.metadata ?? {},
    })
    .select('id')
    .single()

  if (error || !notif) {
    return { ok: false, emailStatus: 'failed', pushStatus: 'no_sub', error: error?.message ?? 'Notification non créée.' }
  }

  // 2. Récupérer les emails du parent
  const parent = await getParentWithEmails(params.parent_id)
  if (!parent) {
    return { ok: false, emailStatus: 'failed', pushStatus: 'no_sub', error: 'Parent introuvable.' }
  }

  const emails = params.emailsOverride ?? getEmails(parent)
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped'
  let pushStatus: 'sent' | 'failed' | 'no_sub' = 'no_sub'
  let emailError: string | undefined

  // 3. Envoyer l'email
  if (emails.length > 0 && params.emailHtml) {
    const result = await sendNotificationEmail({
      to: emails,
      subject: params.emailSubject ?? params.title,
      html: params.emailHtml,
      bcc: params.emailBcc,
      replyTo: params.emailReplyTo,
      attachments: params.emailAttachments,
    })
    emailStatus = result.success ? 'sent' : 'failed'
    emailError = result.error
  }

  // 4. Envoyer le push
  if (parent.user_id) {
    const push = await sendPushToUser(parent.user_id, {
      title: params.title,
      body: params.body,
      url: '/dashboard/notifications',
    })
    pushStatus = push.sent > 0 ? 'sent' : push.failed > 0 ? 'failed' : 'no_sub'
  }

  // 5. Update statuts
  await supabase
    .from('notifications')
    .update({ email_status: emailStatus, push_status: pushStatus })
    .eq('id', notif.id)

  return { ok: emailStatus !== 'failed', emailStatus, pushStatus, error: emailError }
}

/**
 * Récupère un parent avec ses emails.
 */
export async function getParentWithEmails(parentId: string): Promise<ParentInfo | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('parents')
    .select('id, user_id, tutor1_first_name, tutor1_last_name, tutor1_email, tutor2_email')
    .eq('id', parentId)
    .single()
  return data as ParentInfo | null
}

/**
 * Récupère le parent d'un élève.
 */
export async function getParentByStudentId(studentId: string): Promise<ParentInfo | null> {
  const supabase = createAdminClient()
  const { data: student } = await supabase
    .from('students')
    .select('parent_id')
    .eq('id', studentId)
    .single()

  if (!student?.parent_id) return null
  return getParentWithEmails(student.parent_id)
}

function getEmails(parent: ParentInfo): string[] {
  const emails: string[] = []
  if (parent.tutor1_email) emails.push(parent.tutor1_email)
  if (parent.tutor2_email) emails.push(parent.tutor2_email)
  return emails
}
