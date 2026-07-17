'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { sendNotificationEmail, hasSmtpConfig } from '@/lib/email'
import { sanitize } from '@/lib/security/sanitize'
import { FINANCE_ROLES } from '@/lib/financements/roles'

export interface FinancementCommunication {
  id: string
  parent_id: string
  type: 'relance' | 'attestation'
  subject: string
  recipients: string | null
  status: string
  sent_at: string
  sent_by: string | null
}

export interface SendRelancePayload {
  parentId:     string
  schoolYearId: string | null
  subject:      string
  body:         string   // texte brut (converti en HTML pour l'email)
}

export interface SendRelanceResult {
  error?:        string
  communication?: FinancementCommunication
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendRelance(payload: SendRelancePayload): Promise<SendRelanceResult> {
  const { error: roleError } = await requireRoleServer(FINANCE_ROLES)
  if (roleError) return { error: roleError }

  const subject = payload.subject?.trim() ?? ''
  const body    = payload.body?.trim() ?? ''
  if (!subject) return { error: "L'objet est obligatoire." }
  if (!body)    return { error: 'Le message est obligatoire.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('etablissement_id, email')
    .eq('id', user.id)
    .single()
  if (!profile?.etablissement_id) return { error: 'Établissement introuvable.' }

  // Destinataires : les deux tuteurs du foyer.
  const { data: parent } = await supabase
    .from('parents')
    .select('tutor1_email, tutor2_email')
    .eq('id', payload.parentId)
    .single()

  const recipients = [parent?.tutor1_email, parent?.tutor2_email].filter((e): e is string => !!e)
  if (recipients.length === 0) {
    return { error: "Cette famille n'a aucune adresse email : impossible d'envoyer la relance." }
  }

  if (!(await hasSmtpConfig(profile.etablissement_id))) {
    return { error: 'Messagerie non configurée : renseignez-la dans Paramètres → Établissement.' }
  }

  const { data: etab } = await supabase
    .from('etablissements')
    .select('contact')
    .eq('id', profile.etablissement_id)
    .single()

  // Le parent repond a l'ecole ; repli sur l'expediteur si pas de contact.
  const replyTo = etab?.contact?.trim() || profile.email || undefined

  // Corps redige dans l'editeur riche : deja du HTML, on le sanitise (jamais de
  // nl2br/escape ici, sinon les balises seraient echappees). La signature
  // (coordonnees etablissement) fait partie du corps edite.
  const safeBody = sanitize(body)
  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${escapeHtml(subject)}</h2>
      <div style="color: #444; line-height: 1.6;">${safeBody}</div>
    </div>
  `

  const res = await sendNotificationEmail({
    etablissementId: profile.etablissement_id,
    to: recipients,
    subject,
    html: emailHtml,
    replyTo,
  })

  const status: 'sent' | 'failed' = res.success ? 'sent' : 'failed'

  // Journalisation (client session → acteur capte). Toujours enregistre, meme en
  // echec, pour tracer la tentative.
  const { data: comm, error: insError } = await supabase
    .from('financement_communications')
    .insert({
      etablissement_id: profile.etablissement_id,
      parent_id:        payload.parentId,
      school_year_id:   payload.schoolYearId,
      type:             'relance',
      subject,
      body_html:        safeBody,
      recipients:       recipients.join(', '),
      sent_by:          user.id,
      status,
    })
    .select('id, parent_id, type, subject, recipients, status, sent_at, sent_by')
    .single()

  if (!res.success) {
    return { error: `L'email n'a pas pu être envoyé : ${res.error ?? 'erreur inconnue'}` }
  }
  if (insError) {
    // Email parti mais journalisation KO : on le signale sans bloquer.
    return { communication: undefined }
  }

  return { communication: comm as FinancementCommunication }
}

// ─── Attestation de paiement ───────────────────────────────────────────────────
// L'attestation N'EST PAS envoyee par email : elle est generee cote client et
// ouverte pour impression (le tuteur la retire a l'ecole, signature + cachet).
// Cette action ne fait que TRACER sa delivrance dans l'historique.

export interface LogAttestationPayload {
  parentId:     string
  schoolYearId: string | null
  subject:      string    // libelle pour l'historique
  recipients:   string    // nom(s) du/des tuteur(s) au nom de qui l'attestation est etablie
}

export async function logAttestation(payload: LogAttestationPayload): Promise<SendRelanceResult> {
  const { error: roleError } = await requireRoleServer(FINANCE_ROLES)
  if (roleError) return { error: roleError }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('etablissement_id')
    .eq('id', user.id)
    .single()
  if (!profile?.etablissement_id) return { error: 'Établissement introuvable.' }

  const { data: comm, error: insError } = await supabase
    .from('financement_communications')
    .insert({
      etablissement_id: profile.etablissement_id,
      parent_id:        payload.parentId,
      school_year_id:   payload.schoolYearId,
      type:             'attestation',
      subject:          payload.subject,
      body_html:        null,
      recipients:       payload.recipients,   // nom(s) du/des tuteur(s), pas des emails
      sent_by:          user.id,
      status:           'sent',               // 'sent' = delivree
    })
    .select('id, parent_id, type, subject, recipients, status, sent_at, sent_by')
    .single()

  if (insError) return { error: "L'attestation n'a pas pu être tracée." }
  return { communication: comm as FinancementCommunication }
}
