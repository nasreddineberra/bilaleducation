import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import TempsPresenceClient from '@/components/temps-presence/TempsPresenceClient'

export default async function TempsPresencePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: initialMonth } = await searchParams
  const supabase = await createClient()
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''

  // Etablissement (en-tete de l'export PDF du recapitulatif)
  const { data: etab } = await supabase
    .from('etablissements')
    .select('nom, logo_url')
    .eq('id', etablissementId)
    .maybeSingle()

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'
  // Gestionnaires « tout le staff » (aligne sur la RLS staff_time_entries_manage).
  // Le responsable pedagogique gere UNIQUEMENT les enseignants → traite a part cote client.
  const canManageAll = ['admin', 'direction', 'comptable', 'secretaire'].includes(role)
  const canSeeRecap = ['admin', 'direction', 'comptable', 'responsable_pedagogique'].includes(role)

  // Annee scolaire courante
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .maybeSingle()

  // Liste du staff (profiles actifs, sauf parent et super_admin)
  const { data: staffList } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .not('role', 'in', '("parent","super_admin")')
    .eq('is_active', true)
    .order('last_name')
    .order('first_name')

  // Types de presence actifs de l'annee en cours (etablissement via RLS)
  let presenceTypes: { id: string; label: string; code: string; color: string; is_absence: boolean }[] = []
  if (currentYear) {
    const { data } = await supabase
      .from('presence_types')
      .select('id, label, code, color, is_absence')
      .eq('is_active', true)
      .eq('school_year_id', currentYear.id)
      .order('order_index')
      .order('label')
    presenceTypes = (data ?? []) as typeof presenceTypes
  }

  // Taux par type de presence pour l'annee en cours
  let presenceTypeRates: { presence_type_id: string; rate: number }[] = []
  if (currentYear) {
    const { data } = await supabase
      .from('presence_type_rates')
      .select('presence_type_id, rate')
      .eq('school_year_id', currentYear.id)
    presenceTypeRates = (data ?? []) as { presence_type_id: string; rate: number }[]
  }

  return (
    <div className="h-full animate-fade-in">
      <TempsPresenceClient
        currentUserId={userId}
        currentUserName={`${profile?.last_name ?? ''} ${profile?.first_name ?? ''}`}
        role={role}
        canManageAll={canManageAll}
        canSeeRecap={canSeeRecap}
        staffList={(staffList ?? []) as any[]}
        presenceTypes={(presenceTypes ?? []) as any[]}
        presenceTypeRates={presenceTypeRates}
        schoolYearId={currentYear?.id ?? null}
        initialMonth={initialMonth}
        etablissementNom={etab?.nom ?? 'Établissement'}
        etablissementLogo={etab?.logo_url ?? null}
      />
    </div>
  )
}
