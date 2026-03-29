import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import TeachersClient from '@/components/teachers/TeachersClient'

export const metadata: Metadata = {
  title: 'Enseignants',
}

export default async function TeachersPage() {
  const supabase = await createClient()

  const { data: teachers } = await supabase
    .from('teachers')
    .select('*')
    .order('last_name')
    .order('first_name')

  return <TeachersClient teachers={teachers ?? []} />
}
