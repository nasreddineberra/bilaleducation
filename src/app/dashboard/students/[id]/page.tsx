import { createClient } from '@/lib/supabase/server'
import { hrefRetour } from '@/lib/navigation/retour'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StudentDetail from '@/components/students/StudentDetail'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerFicheEleve } from '@/lib/students/fiche'

interface Props {
  params: Promise<{ id: string }>
  // `lq` / `lf` / `lp` portent l'etat de la liste qu'on a quittee (recherche,
  // filtre, page) sous un prefixe reserve. Voir `lib/navigation/retour`.
  searchParams: Promise<{ from?: string; lq?: string; lf?: string; lp?: string }>
}

export default async function EditStudentPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const { from } = sp
  // Le retour suit l'ORIGINE : liste des apprenants par defaut, mais fiche foyer
  // ou AUDIT quand on en vient — et il RESTITUE l'etat de cette liste (filtre,
  // recherche, page). Voir `lib/navigation/retour`.
  const backHref  = hrefRetour(from, '/dashboard/students', sp)
  const backLabel = from === 'parents' ? 'Retour aux parents' : 'Retour à la liste'
  const supabase = await createClient()

  // QUI REGARDE CETTE FICHE. L'ecriture de `students` est reservee a admin,
  // direction, responsable pedagogique et secretaire (matrice du 5 aout) :
  // l'enseignant LIT ses eleves, il ne les modifie pas. L'ecran l'ignorait et
  // presentait un formulaire editable a tout le monde — et comme une ecriture
  // ecartee par la RLS ne leve rien, elle passait pour un succes.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profil } = await supabase
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', user?.id ?? '')
    .single()
  const ROLES_ECRITURE = ['admin', 'direction', 'responsable_pedagogique', 'secretaire']
  const lectureSeule = !ROLES_ECRITURE.includes(effectiveRole(profil) ?? '')

  // Lectures de la fiche : `lib/students/fiche.ts` (les types de l'ecran en derivent).
  const fiche = await chargerFicheEleve(supabase, id, lectureSeule)
  if (!fiche) notFound()

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        {backLabel}
      </Link>

      <StudentDetail
        {...fiche}
        lectureSeule={lectureSeule}
        backHref={backHref}
        etablissementId={fiche.student.etablissement_id}
      />

    </div>
  )
}
