import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { hrefRetour } from '@/lib/navigation/retour'
import ParentDetail from '@/components/parents/ParentDetail'
import { effectiveRole } from '@/lib/auth/effective-role'
import { LIBELLES_REGLE, REGLE_PAR_DEFAUT, type RegleAjustement } from '@/lib/financements/compute'
import { chargerScolariteAdulte } from '@/lib/parents/fiche'

interface Props {
  params: Promise<{ id: string }>
  // `lq` / `lf` / `lp` portent l'etat de la liste qu'on a quittee (recherche,
  // filtre, page) sous un prefixe reserve. Voir `lib/navigation/retour`.
  searchParams: Promise<{ from?: string; lq?: string; lf?: string; lp?: string }>
}

export default async function EditParentPage({ params, searchParams }: Props) {
  const { id } = await params
  // Le retour suit l'ORIGINE : la liste des foyers par defaut, l'AUDIT quand on
  // en vient (un adulte coche « cours adultes » sans inscription se corrige ici)
  // — et il RESTITUE l'etat de cette liste (filtre, recherche, page).
  const sp = await searchParams
  const { from } = sp
  const backHref = hrefRetour(from, '/dashboard/parents', sp)
  const supabase = await createClient()

  const { data: parent } = await supabase
    .from('parents')
    .select('*')
    .eq('id', id)
    .single()

  if (!parent) notFound()

  // Tuteurs inscrits a une classe adulte → la case « Inscrit aux cours adultes »
  // est grisee (on ne peut pas la decocher tant qu'inscrit).
  const { data: adultEnr } = await supabase
    .from('parent_class_enrollments')
    .select('tutor_number, classes!inner(cotisation_types:cotisation_type_id(is_adult))')
    .eq('parent_id', id).eq('status', 'active')
  const enrolledTutors = new Set(
    (adultEnr ?? []).filter(r => r.classes.cotisation_types?.is_adult).map(r => r.tutor_number)
  )

  // Historique « scolarité adulte » (snapshots de clôture), plus récent en premier.
  const { data: adultHistory } = await supabase
    .from('student_year_history')
    .select('*')
    .eq('parent_id', id)
    .eq('participant_type', 'adult')
    .order('year_label', { ascending: false })

  // ── ANNÉE EN COURS ──
  // L'onglet ne montrait que les ARCHIVES : un adulte inscrit cette année y lisait
  // « aucun cours archivé », alors que sa classe, ses notes et son assiduité
  // existent bel et bien. On construit donc la scolarité VIVANTE, une carte par
  // tuteur inscrit — un foyer peut en compter deux.
  // « Declarer un depart » : roles qui affectent (la RPC applique la meme garde).
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profil } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user?.id ?? '').single()
  const peutDeclarer = ['admin', 'direction', 'responsable_pedagogique', 'secretaire'].includes(effectiveRole(profil) ?? '')

  const adultCurrent = await chargerScolariteAdulte(supabase, id, parent, peutDeclarer)
  const { data: etab } = await supabase.from('etablissements').select('regle_ajustement').maybeSingle()
  const contexteDepart = adultCurrent[0]
    ? {
        regle:   LIBELLES_REGLE[((etab?.regle_ajustement ?? REGLE_PAR_DEFAUT) as RegleAjustement)],
        rentree: adultCurrent[0].rentree,
        fin:     adultCurrent[0].fin,
      }
    : null

  // Tuteurs INSCRITS aux cours adultes mais AFFECTÉS À AUCUNE classe. Le cas est
  // exactement celui de l'apprenant sans classe, et il se nomme : un foyer peut
  // compter deux tuteurs, dont un seul concerné.
  const affectes = new Set(adultCurrent.map(c => c.tutor_number))
  const adultsNonAffectes = [
    parent.tutor1_adult_courses && !affectes.has(1)
      ? { tutor_number: 1, last_name: parent.tutor1_last_name, first_name: parent.tutor1_first_name }
      : null,
    parent.tutor2_adult_courses && !affectes.has(2) && parent.tutor2_last_name
      ? { tutor_number: 2, last_name: parent.tutor2_last_name, first_name: parent.tutor2_first_name }
      : null,
  ].filter(Boolean) as { tutor_number: number; last_name: string; first_name: string }[]

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ParentDetail
        parent={parent}
        backHref={backHref}
        tutor1AdultEnrolled={enrolledTutors.has(1)}
        tutor2AdultEnrolled={enrolledTutors.has(2)}
        adultHistory={adultHistory ?? []}
        adultCurrent={adultCurrent}
        adultsNonAffectes={adultsNonAffectes}
        contexteDepart={contexteDepart}
      />

    </div>
  )
}

