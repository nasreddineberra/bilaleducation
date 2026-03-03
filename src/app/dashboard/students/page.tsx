import { createClient } from '@/lib/supabase/server'
import StudentsClient from '@/components/students/StudentsClient'

export default async function StudentsPage() {
  const supabase = await createClient()

  const [{ data: students }, { data: etablissement }] = await Promise.all([
    supabase.from('students').select('*').order('last_name').order('first_name'),
    supabase.from('etablissements').select('max_students').single(),
  ])

  return <StudentsClient students={students ?? []} maxStudents={etablissement?.max_students ?? null} />
}
