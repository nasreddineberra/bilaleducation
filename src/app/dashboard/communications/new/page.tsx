import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { hasSmtpConfig } from '@/lib/email'
import { buildSignatureHtml } from '@/lib/communications/signature'
import NewMessageClient from '@/components/communications/NewMessageClient'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerNouveauMessage } from '@/lib/communications/donnees'

// Communication aux parents = voix de l'etablissement. L'enseignant ne communique
// que les devoirs (cahier de texte) ; le comptable passe par Financements.
const PARENT_COMM_ROLES = ['admin', 'direction', 'secretaire', 'responsable_pedagogique']

export default async function NewMessagePage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, etablissement_id')
    .eq('id', user.id)
    .single()

  const role = effectiveRole(profile) ?? ''
  if (!PARENT_COMM_ROLES.includes(role)) redirect('/dashboard/communications')

  // Annee scolaire en cours
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  const yearLabel = schoolYear?.label ?? null

  // Classes de l'annee (titulaire en poste), foyers, participants par classe
  // (`lib/communications/donnees.ts`).
  const { classes, parents, classParticipants, enrolledParentIds } = await chargerNouveauMessage(supabase, yearLabel)

  // ─── Pre-requis d'envoi ────────────────────────────────────────────────────
  // On bloque en amont plutot que de laisser rediger puis echouer a l'envoi.
  const { data: etab } = await supabase
    .from('etablissements')
    .select('nom, contact, adresse, telephone')
    .eq('id', etablissementId)
    .single()

  const smtpConfigured = etablissementId ? await hasSmtpConfig(etablissementId) : false

  // Signature auto (editable) ajoutee au corps : Cordialement + coordonnees.
  const signatureHtml = buildSignatureHtml(etab)

  return (
    <div className="animate-fade-in">
      <NewMessageClient
        role={role}
        classes={classes}
        parents={parents}
        classParticipants={classParticipants}
        enrolledParentIds={enrolledParentIds}
        etablissementId={etablissementId}
        smtpConfigured={smtpConfigured}
        contact={etab?.contact ?? null}
        yearLabel={yearLabel}
        signatureHtml={signatureHtml}
      />
    </div>
  )
}
