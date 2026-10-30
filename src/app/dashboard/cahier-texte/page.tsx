import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import CahierTexteClient from '@/components/cahier-texte/CahierTexteClient'
import { AlertTriangle } from 'lucide-react'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerCahierTexte } from '@/lib/cahier-texte/donnees'

export default async function CahierTextePage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', userId)
    .single()

  const role = effectiveRole(profile) ?? 'enseignant'

  // Lectures : `lib/cahier-texte/donnees.ts` (les types de l'ecran en derivent).
  const { teacher, ...donnees } = await chargerCahierTexte(supabase, userId, role)

  if (donnees.classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in">
        <AlertTriangle size={36} className="text-warm-700" />
        <p className="text-sm text-warm-700">Aucune classe disponible.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <CahierTexteClient
        {...donnees}
        role={role}
        teacherId={teacher?.id ?? null}
        etablissementId={etablissementId}
        moi={teacher ?? null}
      />
    </div>
  )
}
