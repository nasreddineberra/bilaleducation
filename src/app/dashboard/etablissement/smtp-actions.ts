'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'
import { verifySmtpConfig, sendTestEmail, type SmtpConfig } from '@/lib/email'
import { revalidatePath } from 'next/cache'

// La messagerie engage l'etablissement entier : reservee a admin/direction.
const SMTP_ROLES = ['admin', 'direction'] as const

/** Config telle qu'exposee au navigateur : SANS le mot de passe, jamais. */
export interface SmtpConfigPublic {
  host:       string
  port:       number
  secure:     boolean
  username:   string
  from_name:  string | null
  from_email: string
  /** Un mot de passe est enregistre (mais on ne le renvoie pas). */
  hasPassword: boolean
}

export interface SaveSmtpPayload {
  host:       string
  port:       number
  secure:     boolean
  username:   string
  /** Vide = conserver le mot de passe existant (champ en ecriture seule). */
  password:   string
  from_name:  string
  from_email: string
}

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' as const }

  const { data: profile } = await supabase
    .from('profiles')
    .select('etablissement_id')
    .eq('id', user.id)
    .single()

  if (!profile?.etablissement_id) return { error: 'Établissement introuvable.' as const }
  return { supabase, etablissementId: profile.etablissement_id }
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

export async function getSmtpSettings(): Promise<{ error?: string; config?: SmtpConfigPublic | null }> {
  const { error: roleError } = await requireRoleServer([...SMTP_ROLES])
  if (roleError) return { error: roleError }

  const ctx = await getContext()
  if ('error' in ctx) return { error: ctx.error }

  // Table verrouillee cote client (RLS sans policy) : seul le service-role la lit.
  const admin = createAdminClient()
  const { data } = await admin
    .from('etablissement_smtp')
    .select('host, port, secure, username, password, from_name, from_email')
    .eq('etablissement_id', ctx.etablissementId)
    .maybeSingle()

  if (!data) return { config: null }

  // Le mot de passe est retire ici, et nulle part ailleurs : c'est le seul point
  // de sortie vers le navigateur.
  const { password, ...rest } = data as SmtpConfig
  return { config: { ...rest, hasPassword: !!password } }
}

// ─── Ecriture ────────────────────────────────────────────────────────────────

function validate(p: SaveSmtpPayload): string | null {
  if (!p.host.trim())       return 'Le serveur SMTP est obligatoire.'
  if (!p.username.trim())   return "L'identifiant est obligatoire."
  if (!p.from_email.trim()) return "L'adresse d'expédition est obligatoire."
  if (!Number.isInteger(p.port) || p.port <= 0 || p.port > 65535) return 'Le port est invalide.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.from_email.trim())) return "L'adresse d'expédition est invalide."
  return null
}

/** Complete le payload avec le mot de passe existant si l'utilisateur ne l'a pas ressaisi. */
async function resolveConfig(etablissementId: string, p: SaveSmtpPayload): Promise<SmtpConfig | null> {
  let password = p.password
  if (!password) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('etablissement_smtp')
      .select('password')
      .eq('etablissement_id', etablissementId)
      .maybeSingle()
    password = (data as { password: string } | null)?.password ?? ''
  }
  if (!password) return null

  return {
    host:       p.host.trim(),
    port:       p.port,
    secure:     p.secure,
    username:   p.username.trim(),
    password,
    from_name:  p.from_name.trim() || null,
    from_email: p.from_email.trim(),
  }
}

export async function saveSmtpSettings(payload: SaveSmtpPayload): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer([...SMTP_ROLES])
  if (roleError) return { error: roleError }

  const invalid = validate(payload)
  if (invalid) return { error: invalid }

  const ctx = await getContext()
  if ('error' in ctx) return { error: ctx.error }

  const config = await resolveConfig(ctx.etablissementId, payload)
  if (!config) return { error: 'Le mot de passe est obligatoire.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('etablissement_smtp')
    .upsert({ etablissement_id: ctx.etablissementId, ...config }, { onConflict: 'etablissement_id' })

  if (error) return { error: "La configuration n'a pas pu être enregistrée." }

  // Ecriture via service-role (secret) → le trigger d'audit ne capterait pas
  // l'acteur, et copierait le mot de passe en clair dans le journal. D'ou une
  // trace explicite, en client session, sans le secret.
  await logAudit(ctx.supabase, {
    action:      'UPDATE',
    entityType:  'etablissement_smtp',
    entityId:    ctx.etablissementId,
    description: `Configuration de la messagerie modifiée (serveur ${config.host}:${config.port}, expéditeur ${config.from_email})`,
  })

  revalidatePath('/dashboard/etablissement')
  return {}
}

// ─── Test ────────────────────────────────────────────────────────────────────

/**
 * Teste la configuration SAISIE (pas celle enregistree) : on valide avant de
 * sauvegarder, et on n'a pas besoin de renvoyer le mot de passe au navigateur
 * pour ca. Si le champ est vide, on reprend celui deja en base.
 */
export async function testSmtpSettings(payload: SaveSmtpPayload): Promise<{ error?: string; message?: string }> {
  const { error: roleError } = await requireRoleServer([...SMTP_ROLES])
  if (roleError) return { error: roleError }

  const invalid = validate(payload)
  if (invalid) return { error: invalid }

  const ctx = await getContext()
  if ('error' in ctx) return { error: ctx.error }

  const config = await resolveConfig(ctx.etablissementId, payload)
  if (!config) return { error: 'Renseignez le mot de passe pour tester la connexion.' }

  const verified = await verifySmtpConfig(config)
  if (!verified.ok) return { error: `Connexion refusée : ${verified.error}` }

  // Le test va jusqu'a l'envoi reel : une connexion qui repond ne prouve pas
  // qu'un message part (quota, expediteur refuse, compte restreint…).
  const { data: etab } = await ctx.supabase
    .from('etablissements')
    .select('contact')
    .eq('id', ctx.etablissementId)
    .single()

  const contact = etab?.contact?.trim()
  if (!contact) {
    return { message: "Connexion au serveur réussie. Aucun message de test envoyé : l'adresse de contact de l'établissement n'est pas renseignée." }
  }

  const sent = await sendTestEmail(config, contact)
  if (!sent.ok) return { error: `Connexion réussie, mais l'envoi a échoué : ${sent.error}` }

  return { message: `Connexion réussie. Un message de test a été envoyé à ${contact}.` }
}
