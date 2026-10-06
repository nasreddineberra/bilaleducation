import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { hrefRetour } from '@/lib/navigation/retour'
import TeacherDetail from '@/components/teachers/TeacherDetail'
import { chargerAssiduite } from '@/lib/temps-presence/assiduite'
import type { TeacherDocument } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
  // `lq` / `lf` / `lp` portent l'etat de la liste qu'on a quittee (recherche,
  // filtre, page) sous un prefixe reserve. Voir `lib/navigation/retour`.
  searchParams: Promise<{ from?: string; lq?: string; lf?: string; lp?: string }>
}

export default async function EditTeacherPage({ params, searchParams }: Props) {
  const { id } = await params
  // Cette fiche n'avait AUCUNE tuyauterie de retour : le lien et le defaut de
  // `TeacherForm` etaient ecrits en dur, donc le retour perdait le filtre de la
  // liste. Il le RESTITUE desormais, comme les fiches apprenant et foyer.
  const sp = await searchParams
  const backHref = hrefRetour(sp.from, '/dashboard/teachers', sp)
  const supabase = await createClient()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single()

  if (!teacher) notFound()

  // Documents lies (peut etre vide / null si la migration n'est pas encore passee)
  const { data: documents } = await supabase
    .from('teacher_documents')
    .select('id, etablissement_id, teacher_id, category, label, file_url, file_name, expires_at, created_at')
    .eq('teacher_id', id)
    .order('created_at', { ascending: false })

  // Assiduite : le compte de connexion est le pivot, `staff_time_entries` etant
  // indexee par `profiles.id`. Une fiche sans compte n'a aucune presence
  // rattachee, et le resolveur le dit lui-meme.
  const assiduite = await chargerAssiduite(supabase, teacher.user_id ?? null)

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <TeacherDetail
        teacher={teacher}
        documents={(documents ?? []) as TeacherDocument[]}
        assiduite={assiduite}
        backHref={backHref}
      />

    </div>
  )
}
