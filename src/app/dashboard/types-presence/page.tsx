import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import TypesPresenceClient from '@/components/types-presence/TypesPresenceClient'

export default async function TypesPresencePage() {
  const supabase = await createClient()

  // Réservé aux admin et direction
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'direction'].includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  // Année scolaire en cours (les types y sont rattachés)
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
    .eq('is_current', true)
    .maybeSingle()

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center animate-fade-in">
        <AlertTriangle size={32} className="text-warm-400" />
        <p className="text-sm text-warm-500">
          Aucune année scolaire en cours. Définissez-en une pour gérer les types de présence.
        </p>
      </div>
    )
  }

  // Types de l'année en cours (établissement filtré par RLS)
  const { data: types } = await supabase
    .from('presence_types')
    .select('id, label, code, color, is_active, is_absence, order_index, school_year_id')
    .eq('school_year_id', currentYear.id)
    .order('order_index')
    .order('label')

  // Année précédente (pour « Copier depuis l'année précédente »)
  const { data: previousYear } = await supabase
    .from('school_years')
    .select('id, label')
    .lt('label', currentYear.label)
    .order('label', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="space-y-6 animate-fade-in">
      <TypesPresenceClient
        initialTypes={(types ?? []) as any[]}
        currentYear={{
          id:         currentYear.id,
          label:      currentYear.label,
          start_date: currentYear.start_date,
          end_date:   currentYear.end_date,
        }}
        previousYear={previousYear ?? null}
      />
    </div>
  )
}
