import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import TeacherForm from '@/components/teachers/TeacherForm'

export default async function NewTeacherPage() {
  const supabase = await createClient()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  // Incrément annuel : on cherche le plus grand séquentiel de toute l'année
  const { data: lastTeachers } = await supabase
    .from('teachers')
    .select('employee_number')
    .like('employee_number', `ENS-${year}%`)
    .order('employee_number', { ascending: false })
    .limit(1)

  // Préfixe = année + mois d'embauche (défaut = aujourd'hui)
  let nextSeq = 1
  const lastNum = lastTeachers?.[0]?.employee_number
  if (lastNum) {
    const parts = lastNum.split('-')
    const seq = parseInt(parts[2] ?? '0', 10)
    if (!isNaN(seq)) nextSeq = seq + 1
  }
  const defaultEmployeeNumber = `ENS-${year}${month}-${String(nextSeq).padStart(3, '0')}`

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/teachers"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <TeacherForm defaultEmployeeNumber={defaultEmployeeNumber} />

    </div>
  )
}
