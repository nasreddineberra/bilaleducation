import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import StudentForm from '@/components/students/StudentForm'
import { compterBaseFacturable } from '@/lib/tenant/base-facturable'

const PARENTS_SELECT = [
  'id',
  'tutor1_last_name', 'tutor1_first_name', 'tutor1_relationship',
  'tutor1_address', 'tutor1_city', 'tutor1_postal_code', 'tutor1_phone', 'tutor1_email',
  'tutor2_last_name', 'tutor2_first_name', 'tutor2_relationship',
  'tutor2_address', 'tutor2_city', 'tutor2_postal_code', 'tutor2_phone', 'tutor2_email',
].join(', ')

export default async function NewStudentPage() {
  const supabase = await createClient()
  const now   = new Date()
  const year  = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const [{ data: parents }, { data: lastStudents }, { data: etablissement }, base] = await Promise.all([
    supabase
      .from('parents')
      .select(PARENTS_SELECT)
      .order('tutor1_last_name')
      .order('tutor1_first_name'),

    // On cherche sur toute l'année pour récupérer le plus grand séquentiel
    supabase
      .from('students')
      .select('student_number')
      .like('student_number', `ELV-${year}%`)
      .order('student_number', { ascending: false })
      .limit(1),

    supabase.from('etablissements').select('id, max_students').single(),

    compterBaseFacturable(supabase),
  ])

  const maxStudents = etablissement?.max_students ?? null
  // Comptage en echec : on ne bloque pas l ecran, la base garde la limite elle-meme.
  const limitReached = maxStudents != null && base !== null && base.total >= maxStudents

  // Incrément annuel, préfixe avec année + mois courant
  // ex : ELV-202601-001 en jan, ELV-202603-006 en mars (si 5 élèves créés en jan)
  let nextSeq = 1
  const lastNum = lastStudents?.[0]?.student_number
  if (lastNum) {
    const parts = lastNum.split('-')
    const seq = parseInt(parts[2] ?? '0', 10)
    if (!isNaN(seq)) nextSeq = seq + 1
  }
  const defaultStudentNumber = `ELV-${year}${month}-${String(nextSeq).padStart(3, '0')}`

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/students"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      {limitReached ? (
        <div className="card p-6 flex flex-col items-center gap-4 text-center max-w-lg">
          <AlertCircle className="text-orange-400" size={36} />
          <div>
            <p className="text-base font-semibold text-secondary-800">Limite de l&apos;abonnement atteinte</p>
            <p className="text-sm text-warm-700 mt-1">
              Votre abonnement est limité à <strong>{maxStudents} inscrit{maxStudents! > 1 ? 's' : ''}</strong>
              {base ? <> ({base.eleves} élève{base.eleves > 1 ? 's' : ''} actif{base.eleves > 1 ? 's' : ''} + {base.adultes} adulte{base.adultes > 1 ? 's' : ''} inscrit{base.adultes > 1 ? 's' : ''})</> : null}.
              Contactez l&apos;éditeur pour l&apos;augmenter.
            </p>
          </div>
          <Link href="/dashboard/students" className="btn btn-secondary text-sm">
            Retour à la liste
          </Link>
        </div>
      ) : (
        <StudentForm parents={(parents ?? []) as any[]} defaultStudentNumber={defaultStudentNumber} etablissementId={etablissement?.id} />
      )}

    </div>
  )
}
