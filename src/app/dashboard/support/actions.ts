'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveRole } from '@/lib/auth/effective-role'
import { sendNotificationEmail, SMTP_NOT_CONFIGURED } from '@/lib/email'
import { escapeHtml, escapeHtmlMultiline } from '@/lib/security/escape-html'
import { formatDateHeureFr } from '@/lib/dates'
import {
  SUPPORT_CATEGORIES,
  SUPPORT_IMPACTS,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_MAX_LABEL,
  SUPPORT_ATTACHMENT_TYPES,
  categoryLabel,
  impactLabel,
} from '@/lib/support/categories'

/**
 * Adresse de l'éditeur. En dur, et non dans une variable d'environnement : elle
 * ne dépend pas de l'établissement, et une variable absente en production
 * ferait échouer l'envoi au moment précis où l'école appelle à l'aide.
 */
const SUPPORT_EMAIL = 'superadmin@bilaleducation.fr'

/** Rôles autorisés à écrire à l'éditeur. Règle du projet : `admin` = `direction`. */
const ROLES_SUPPORT = ['admin', 'direction']

export interface SupportRequestResult {
  error?: string
  /** La demande est enregistrée ; l'email a-t-il suivi ? */
  enregistree?: boolean
  emailEnvoye?: boolean
}

export async function sendSupportRequest(formData: FormData): Promise<SupportRequestResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, etablissement_id, civilite, first_name, last_name, email')
    .eq('id', user.id)
    .single()

  const role = effectiveRole(profile)
  if (!profile?.etablissement_id || !ROLES_SUPPORT.includes(role ?? '')) {
    return { error: 'Accès refusé.' }
  }

  // ── Validation ────────────────────────────────────────────────────────────
  // Refaite ici INTÉGRALEMENT : les contrôles du formulaire améliorent le
  // confort, ils ne protègent rien — une server action est appelable
  // directement.

  const category = String(formData.get('category') ?? '')
  const impactBrut = String(formData.get('impact') ?? '')
  const subject = String(formData.get('subject') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()

  if (!SUPPORT_CATEGORIES.some(c => c.value === category)) {
    return { error: 'Choisissez la nature de votre demande.' }
  }

  // L'impact n'a de sens que sur un incident — et la base le refuse ailleurs.
  // On le neutralise plutôt que de rejeter : le formulaire masque le champ au
  // changement de nature, une valeur résiduelle serait une maladresse, pas une
  // tentative.
  const impact =
    category === 'incident' && SUPPORT_IMPACTS.some(i => i.value === impactBrut)
      ? impactBrut
      : null

  if (category === 'incident' && !impact) {
    return { error: "Précisez l'impact de cet incident." }
  }
  if (!subject) return { error: "L'objet est obligatoire." }
  if (subject.length > SUPPORT_SUBJECT_MAX) {
    return { error: `L'objet ne peut dépasser ${SUPPORT_SUBJECT_MAX} caractères.` }
  }
  if (!message) return { error: 'Le message est obligatoire.' }
  if (message.length > SUPPORT_MESSAGE_MAX) {
    return { error: `Le message ne peut dépasser ${SUPPORT_MESSAGE_MAX} caractères.` }
  }

  // Contexte fourni par le navigateur : borné et traité comme du texte
  // d'affichage. Il ne décide de rien, il informe.
  const borne = (v: FormDataEntryValue | null, max: number) =>
    String(v ?? '').slice(0, max)
  const context = {
    page:       borne(formData.get('page'), 200),
    version:    borne(formData.get('version'), 40),
    navigateur: borne(formData.get('userAgent'), 300),
  }

  // ── Pièce jointe ──────────────────────────────────────────────────────────

  const fichier = formData.get('attachment')
  let attachmentPath: string | null = null
  let piece: { filename: string; content: Buffer; contentType: string } | null = null

  if (fichier instanceof File && fichier.size > 0) {
    if (!SUPPORT_ATTACHMENT_TYPES.includes(fichier.type as never)) {
      return { error: 'Pièce jointe : images (PNG, JPEG, WebP) et PDF uniquement.' }
    }
    if (fichier.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
      return { error: `Pièce jointe : ${SUPPORT_ATTACHMENT_MAX_LABEL} maximum.` }
    }

    const ext = (fichier.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5)
    // Premier segment = établissement : c'est LUI que la policy Storage
    // compare. Un chemin construit autrement serait refusé.
    const chemin = `${profile.etablissement_id}/${crypto.randomUUID()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('support-attachments')
      .upload(chemin, fichier, { contentType: fichier.type, upsert: false })

    if (upErr) {
      console.error('[support] envoi de la pièce jointe:', upErr)
      return { error: "La pièce jointe n'a pas pu être envoyée. Réessayez sans elle." }
    }

    attachmentPath = chemin
    piece = {
      filename: fichier.name,
      content: Buffer.from(await fichier.arrayBuffer()),
      contentType: fichier.type,
    }
  }

  // ── 1. ENREGISTRER — avant toute tentative d'envoi ────────────────────────
  //
  // C'est la raison d'être de la table. « Ma messagerie ne fonctionne plus »
  // est un motif de demande ordinaire : envoyer d'abord ferait de cette
  // demande-là la seule incapable d'arriver.
  //
  // Client SESSION : la RLS s'applique, et l'auteur est capté.

  const auteur = [profile.civilite, profile.last_name, profile.first_name]
    .filter(Boolean).join(' ').trim() || (profile.email ?? 'Inconnu')

  const { data: ligne, error: insErr } = await supabase
    .from('support_requests')
    .insert({
      etablissement_id: profile.etablissement_id,
      created_by:       profile.id,
      author_name:      auteur,
      author_email:     profile.email ?? user.email ?? '',
      author_role:      role ?? '',
      category,
      impact,
      subject,
      message,
      attachment_path:  attachmentPath,
      context,
    })
    .select('id, created_at')
    .single()

  if (insErr || !ligne) {
    console.error('[support] enregistrement de la demande:', insErr)
    return { error: "La demande n'a pas pu être enregistrée." }
  }

  // ── 2. NOTIFIER ───────────────────────────────────────────────────────────

  const { data: etab } = await supabase
    .from('etablissements')
    .select('nom, slug')
    .eq('id', profile.etablissement_id)
    .single()

  const envoi = await sendNotificationEmail({
    etablissementId: profile.etablissement_id,
    to: [SUPPORT_EMAIL],
    // La réponse doit partir vers l'AUTEUR, pas vers l'école en général :
    // c'est lui qui a le problème sous les yeux.
    replyTo: profile.email ?? undefined,
    subject: objetEmail(etab?.nom ?? 'École', subject, impact),
    html: corpsEmail({
      categorie: categoryLabel(category),
      impact:    impactLabel(impact),
      objet:     subject,
      message,
      auteur,
      auteurEmail: profile.email ?? '',
      auteurRole:  role ?? '',
      ecole:       etab?.nom ?? '',
      adresse:     etab?.slug ?? '',
      date:        formatDateHeureFr(ligne.created_at),
      context,
      pieceJointe: piece?.filename ?? null,
    }),
    attachments: piece ? [piece] : undefined,
  })

  // Statut d'envoi posé en SERVICE-ROLE, et c'est délibéré : la table n'a
  // aucune policy UPDATE, l'école ne doit pas pouvoir retoucher une demande
  // partie. `email_status` est un champ système, pas une donnée d'école.
  await createAdminClient()
    .from('support_requests')
    .update({
      email_status: envoi.success ? 'sent' : 'failed',
      email_error:  envoi.success ? null : (envoi.error ?? '').slice(0, 500),
    })
    .eq('id', ligne.id)

  if (!envoi.success) {
    console.error('[support] notification non partie:', envoi.error)
  }

  return {
    enregistree: true,
    emailEnvoye: envoi.success,
    // Message d'échec HONNÊTE : la demande est bien enregistrée, c'est la
    // notification qui manque. Dire « échec » ferait recommencer l'utilisateur.
    error: envoi.success
      ? undefined
      : envoi.error === SMTP_NOT_CONFIGURED
        ? "Votre demande est enregistrée, mais la messagerie de l'établissement n'est pas configurée : la notification n'a pas pu partir."
        : "Votre demande est enregistrée, mais la notification n'a pas pu être envoyée.",
  }
}

/**
 * URL signée d'une pièce jointe, valable une minute.
 *
 * Le bucket est PRIVÉ : `getPublicUrl` n'y résout rien. La lecture de la ligne
 * passe par le client SESSION — c'est la RLS qui garantit qu'on ne signe que
 * les pièces de SON établissement, sans qu'aucun contrôle soit à réécrire ici.
 */
export async function getSupportAttachmentUrl(
  id: string
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('support_requests')
    .select('attachment_path')
    .eq('id', id)
    .single()

  if (!data?.attachment_path) return { error: 'Aucune pièce jointe.' }

  const { data: signe, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(data.attachment_path, 60)

  if (error || !signe) {
    console.error('[support] signature de la pièce jointe:', error)
    return { error: "Le fichier n'a pas pu être ouvert." }
  }
  return { url: signe.signedUrl }
}

/**
 * Objet de l'email reçu par l'éditeur.
 *
 *   [Support] BLOQUANT · École Bilal Neuville · Les bulletins ne s'impriment pas
 *   [Support] École Bilal Neuville · Comment inscrire un élève en cours d'année
 *
 * ORDRE : l'urgence, puis qui, puis quoi. C'est celui dans lequel on décide
 * quel message ouvrir en premier.
 *
 * LA NATURE N'Y EST PLUS. Les libellés complets — « Assistance à l'utilisation »,
 * « Abonnement et facturation » — consommaient une cinquantaine de caractères
 * AVANT les mots de l'utilisateur, or une liste de messages tronque vers
 * soixante-dix : on lisait le préfixe et rien d'autre. La nature reste en tête
 * du corps, où elle ne coûte rien.
 *
 * `BLOQUANT` N'APPARAÎT QUE LÀ OÙ IL EST VRAI — ni sur « gênant », ni sur
 * « mineur ». Un marqueur d'urgence présent partout ne signale plus rien.
 *
 * `[Support]` en tête reste stable : c'est ce sur quoi une règle de filtrage
 * s'accroche.
 */
function objetEmail(ecole: string, objet: string, impact: string | null): string {
  const urgence = impact === 'bloquant' ? 'BLOQUANT · ' : ''
  return `[Support] ${urgence}${ecole} · ${objet}`
}

/**
 * Corps de l'email reçu par l'éditeur.
 *
 * TOUT est échappé : l'objet, le message et le contexte viennent d'une saisie,
 * et le contexte du navigateur. Cette boîte est la mienne — une injection y
 * serait une injection chez moi.
 */
function corpsEmail(d: {
  categorie: string
  impact: string | null
  objet: string
  message: string
  auteur: string
  auteurEmail: string
  auteurRole: string
  ecole: string
  adresse: string
  date: string
  context: { page: string; version: string; navigateur: string }
  pieceJointe: string | null
}): string {
  const ligne = (cle: string, valeur: string) => `
    <tr>
      <td style="padding:3px 12px 3px 0; color:#786d64; font-size:12px; white-space:nowrap; vertical-align:top;">${escapeHtml(cle)}</td>
      <td style="padding:3px 0; color:#1f2e35; font-size:12px;">${escapeHtml(valeur)}</td>
    </tr>`

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; max-width:640px;">
    <p style="margin:0 0 4px; font-size:12px; color:#786d64;">${escapeHtml(d.categorie)}${d.impact ? ` &middot; impact ${escapeHtml(d.impact.toLowerCase())}` : ''}</p>
    <h2 style="margin:0 0 16px; font-size:18px; color:#1f2e35;">${escapeHtml(d.objet)}</h2>

    <div style="background:#faf8f6; border-left:3px solid #18aa99; padding:14px 16px; border-radius:0 8px 8px 0; color:#1f2e35; font-size:14px; line-height:1.65;">
      ${escapeHtmlMultiline(d.message)}
    </div>

    ${d.pieceJointe ? `<p style="margin:14px 0 0; font-size:12px; color:#786d64;">Pièce jointe : ${escapeHtml(d.pieceJointe)}</p>` : ''}

    <table style="margin-top:22px; border-top:1px solid #e0d9d1; padding-top:14px; width:100%;">
      ${ligne('École',       d.ecole)}
      ${ligne('Adresse',     d.adresse ? `${d.adresse}.bilaleducation.fr` : '')}
      ${ligne('Auteur',      `${d.auteur} (${d.auteurRole})`)}
      ${ligne('Email',       d.auteurEmail)}
      ${ligne('Envoyée le',  d.date)}
      ${ligne('Page',        d.context.page || 'Non renseignée')}
      ${ligne('Version',     d.context.version || 'Inconnue')}
      ${ligne('Navigateur',  d.context.navigateur || 'Inconnu')}
    </table>

    <p style="margin:18px 0 0; font-size:11px; color:#786d64;">
      Répondre à ce message écrit directement à l'auteur.
    </p>
  </div>`
}
