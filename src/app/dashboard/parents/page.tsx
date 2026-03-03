import { createClient } from '@/lib/supabase/server'
import ParentsClient from '@/components/parents/ParentsClient'

export default async function ParentsPage() {
  const supabase = await createClient()

  const [{ data: parents }, { data: studentLinks }] = await Promise.all([
    supabase
      .from('parents')
      .select('*')
      .order('tutor1_last_name')
      .order('tutor1_first_name')
      .order('tutor2_last_name', { nullsFirst: false })
      .order('tutor2_first_name', { nullsFirst: false }),
    supabase
      .from('students')
      .select('parent_id, is_active, has_pai')
      .not('parent_id', 'is', null),
  ])

  const parentsWithChildren = new Set(
    (studentLinks ?? []).map(s => s.parent_id as string)
  )

  const parentsWithPAI = new Set(
    (studentLinks ?? []).filter(s => s.has_pai).map(s => s.parent_id as string)
  )

  return (
    <ParentsClient
      parents={parents ?? []}
      parentsWithChildren={parentsWithChildren}
      parentsWithPAI={parentsWithPAI}
    />
  )
}
