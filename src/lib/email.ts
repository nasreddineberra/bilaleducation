import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Configuration ───────────────────────────────────────────────────────────
// La messagerie est propre a chaque etablissement (l'app est multi-etablissement),
// donc en base et non en variable d'environnement. La table `etablissement_smtp`
// est verrouillee cote client (RLS sans policy) : seul le service-role la lit —
// c'est une lecture de secret, pas une ecriture de table, la regle de tracabilite
// (« les tables s'ecrivent en client session ») n'est pas en cause ici.

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from_name: string | null
  from_email: string
}

/** Existence de la config, sans toucher au secret : sert a bloquer en amont les
 *  ecrans qui envoient des emails, plutot que de laisser echouer a l'envoi. */
export async function hasSmtpConfig(etablissementId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { count } = await supabase
    .from('etablissement_smtp')
    .select('etablissement_id', { count: 'exact', head: true })
    .eq('etablissement_id', etablissementId)
  return (count ?? 0) > 0
}

export async function getSmtpConfig(etablissementId: string): Promise<SmtpConfig | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('etablissement_smtp')
    .select('host, port, secure, username, password, from_name, from_email')
    .eq('etablissement_id', etablissementId)
    .maybeSingle()
  return (data as SmtpConfig | null) ?? null
}

// ─── Transporteur ────────────────────────────────────────────────────────────
// `pool` + `rateLimit` ne sont pas du confort : a 200-300 foyers, envoyer d'un
// seul elan declenche un blocage temporaire cote fournisseur (Gmail notamment).
// On reutilise les connexions et on etale le debit.
const MAX_CONNECTIONS = 3
const MAX_MESSAGES_PER_CONNECTION = 50
const RATE_DELTA_MS = 1000
const MAX_MESSAGES_PER_RATE_DELTA = 5   // ~5 messages/seconde au plus

type CacheEntry = { transporter: Transporter; signature: string }
const cache = new Map<string, CacheEntry>()

/** Signature de la config : si elle change, le transporteur en cache est perime. */
function signatureOf(c: SmtpConfig): string {
  return `${c.host}|${c.port}|${c.secure}|${c.username}|${c.password}|${c.from_email}|${c.from_name ?? ''}`
}

function buildTransporter(c: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.username, pass: c.password },
    pool: true,
    maxConnections: MAX_CONNECTIONS,
    maxMessages: MAX_MESSAGES_PER_CONNECTION,
    rateDelta: RATE_DELTA_MS,
    rateLimit: MAX_MESSAGES_PER_RATE_DELTA,
  })
}

async function getTransporter(etablissementId: string): Promise<{ transporter: Transporter; config: SmtpConfig } | null> {
  const config = await getSmtpConfig(etablissementId)
  if (!config) return null

  const signature = signatureOf(config)
  const cached = cache.get(etablissementId)

  if (cached && cached.signature === signature) {
    return { transporter: cached.transporter, config }
  }

  cached?.transporter.close()
  const transporter = buildTransporter(config)
  cache.set(etablissementId, { transporter, signature })
  return { transporter, config }
}

/** Compose l'expediteur : nom d'affichage lisible + adresse du compte SMTP. */
function formatFrom(c: SmtpConfig): string {
  return c.from_name ? `"${c.from_name.replace(/"/g, '')}" <${c.from_email}>` : c.from_email
}

// ─── Envoi ───────────────────────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export const SMTP_NOT_CONFIGURED = 'Messagerie non configurée : renseignez le serveur SMTP dans Paramètres → Établissement → Messagerie.'

export async function sendNotificationEmail(params: {
  /** Etablissement expediteur : determine la messagerie utilisee. */
  etablissementId: string
  to: string[]
  subject: string
  html: string
  /** Copie carbone invisible : les destinataires de `to` ne la voient pas. */
  bcc?: string[]
  /** Adresse de reponse. Sans elle, on repond a l'adresse d'envoi. */
  replyTo?: string
  attachments?: EmailAttachment[]
}): Promise<{ success: boolean; error?: string }> {
  const to  = params.to.filter(Boolean)
  const bcc = (params.bcc ?? []).filter(Boolean)

  if (to.length === 0 && bcc.length === 0) {
    return { success: false, error: 'Aucun destinataire.' }
  }

  const resolved = await getTransporter(params.etablissementId)
  if (!resolved) return { success: false, error: SMTP_NOT_CONFIGURED }

  try {
    await resolved.transporter.sendMail({
      from:    formatFrom(resolved.config),
      to:      to.join(', '),
      bcc:     bcc.length > 0 ? bcc.join(', ') : undefined,
      replyTo: params.replyTo || undefined,
      subject: params.subject,
      html:    params.html,
      attachments: params.attachments?.map(a => ({
        filename:    a.filename,
        content:     a.content,
        contentType: a.contentType,
      })),
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// ─── Test de connexion ───────────────────────────────────────────────────────
// On ne decouvre pas une panne SMTP le jour d'un envoi a 300 familles.

/** Verifie qu'une config donnee repond, sans la sauvegarder ni la mettre en cache. */
export async function verifySmtpConfig(c: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  const transporter = buildTransporter(c)
  try {
    await transporter.verify()
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  } finally {
    transporter.close()
  }
}

/** Envoie un message de test avec une config donnee. */
export async function sendTestEmail(c: SmtpConfig, to: string): Promise<{ ok: boolean; error?: string }> {
  const transporter = buildTransporter(c)
  try {
    await transporter.sendMail({
      from:    formatFrom(c),
      to,
      subject: 'Test de la messagerie',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a1a1a;">La messagerie fonctionne</h2>
          <p style="color: #444; line-height: 1.6;">
            Ce message confirme que la configuration SMTP de votre établissement est opérationnelle.
            Les communications aux familles peuvent être envoyées.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Message de test · ${c.from_email}</p>
        </div>
      `,
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  } finally {
    transporter.close()
  }
}
