import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import CahierTexteDetail from '@/components/cahier-texte/CahierTexteDetail'

export default async function CahierTexteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // Fetch journal entry
  const { data: journal } = await supabase
    .from('class_journal')
    .select('*, teachers:teacher_id(first_name, last_name, civilite), classes:class_id(name)')
    .eq('id', id)
    .single()

  if (!journal) notFound()

  // Check if current user is the author (for edit permission)
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', userId)
    .single()

  const isAuthor = teacher?.id === journal.teacher_id
  const canEdit = isAuthor || ['admin', 'direction', 'responsable_pedagogique'].includes(role)

  // Matières de la classe (pour la modale d'édition)
  const { data: cts } = await supabase
    .from('class_teachers')
    .select('subject')
    .eq('class_id', journal.class_id)
  const subjects = [...new Set(((cts ?? []).map((c: { subject: string | null }) => c.subject).filter(Boolean) as string[]))].sort()

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
      <CahierTexteDetail
        journal={journal}
        role={role}
        canEdit={canEdit}
        subjects={subjects}
        etablissementId={etablissementId}
      />
    </div>
  )
}
