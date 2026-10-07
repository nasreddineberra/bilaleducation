import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { EnterButton } from '../../SupportControls'
import EcoleInfoForm from './EcoleInfoForm'
import EcoleUsersSection from './EcoleUsersSection'

/**
 * Fiche d'un établissement client.
 *
 * MISE EN PAGE. Elle défilait, ce qu'aucune fiche de l'application ne fait :
 * trois grandes cartes occupaient une bande entière pour trois nombres, et la
 * colonne de gauche empilait deux encadrés. Les compteurs remontent dans le
 * bandeau d'en-tête et le corps passe en TROIS colonnes — chacune devient assez
 * courte pour tenir. La liste des comptes est bornée en hauteur : sans cela, la
 * page recommencerait à déborder au dixième compte, et on n'aurait traité que le
 * symptôme du jour.
 */
export default async function EcolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: ecole } = await supabase
    .from('etablissements')
    .select('*')
    .eq('id', id)
    .single()

  if (!ecole) notFound()

  // Table serveur uniquement : ni l'école ni son navigateur n'y ont accès.
  const { data: notesRow } = await supabase
    .from('etablissement_notes')
    .select('notes')
    .eq('etablissement_id', id)
    .maybeSingle()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('etablissement_id', id)
    .order('last_name', { ascending: true })

  // Les classes se comptent sur l'ANNEE EN COURS : apres un passage d'annee,
  // celles de l'an passe restent en base et doubleraient le chiffre.
  const { data: anneeCourante } = await supabase
    .from('school_years')
    .select('label')
    .eq('etablissement_id', id)
    .eq('is_current', true)
    .maybeSingle()

  let requeteClasses = supabase
    .from('classes')
    .select('id, cotisation_types(is_adult)')
    .eq('etablissement_id', id)
  if (anneeCourante?.label) requeteClasses = requeteClasses.eq('academic_year', anneeCourante.label)

  const [
    { count: studentsCount },
    { count: elevesActifs },
    { count: foyers },
    { count: adultesT1 },
    { count: adultesT2 },
    { data: classes },
  ] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('etablissement_id', id),
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('etablissement_id', id).eq('is_active', true),
    supabase.from('parents').select('id', { count: 'exact', head: true }).eq('etablissement_id', id),
    // Adultes inscrits = tuteurs coches « cours adultes », tuteur 1 et tuteur 2
    // comptes SEPAREMENT (un foyer peut en compter deux). C'est le pendant
    // d'« eleve actif » : inscrit, pas forcement deja affecte a une classe.
    supabase.from('parents').select('id', { count: 'exact', head: true }).eq('etablissement_id', id).eq('tutor1_adult_courses', true),
    supabase.from('parents').select('id', { count: 'exact', head: true }).eq('etablissement_id', id).eq('tutor2_adult_courses', true),
    requeteClasses,
  ])

  // Sur un comptage `head`, une requete impossible rend `count: null` SANS
  // erreur. Un `?? 0` ferait d'une panne un zero — inacceptable sur des chiffres
  // qui servent a facturer. On affiche alors « ? ».
  const adultesInscrits = adultesT1 === null || adultesT2 === null ? null : adultesT1 + adultesT2
  const baseFacturable  = elevesActifs === null || adultesInscrits === null ? null : elevesActifs + adultesInscrits

  const estAdulte = (c: { cotisation_types: unknown }) => {
    const ct = c.cotisation_types as { is_adult?: boolean } | { is_adult?: boolean }[] | null
    return Array.isArray(ct) ? Boolean(ct[0]?.is_adult) : Boolean(ct?.is_adult)
  }
  const classesAdultes = classes ? classes.filter(estAdulte).length : null

  const { data: { user } } = await (await createClient()).auth.getUser()
  const { data: moi } = user
    ? await supabase.from('profiles').select('etablissement_id').eq('id', user.id).single()
    : { data: null }
  const interventionAilleurs = Boolean(moi?.etablissement_id) && moi!.etablissement_id !== id

  const compteurs: { label: string; value: number | null; facturable?: boolean }[] = [
    { label: 'Utilisateurs',     value: profiles?.length ?? 0 },
    { label: 'Élèves',           value: studentsCount },
    { label: 'Élèves actifs',    value: elevesActifs },
    { label: 'Foyers',           value: foyers },
    { label: 'Adultes inscrits', value: adultesInscrits },
    // Le prix de l'abonnement se calcule sur ce chiffre : il est mis en avant.
    { label: 'Base facturable',  value: baseFacturable, facturable: true },
    {
      // Les classes sont en general des classes d'enfants : on ne precise que
      // les adultes, et seulement s'il y en a (« dont 0 adulte » n'apprend rien).
      label: classesAdultes ? `Classes (dont ${classesAdultes} adulte${classesAdultes > 1 ? 's' : ''})` : 'Classes',
      value: classes ? classes.length : null,
    },
  ]

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Retour, au niveau page — même forme que les fiches classe et année scolaire. */}
      <Link
        href="/superadmin"
        className="inline-flex items-center gap-1 text-sm text-warm-700 hover:text-secondary-700 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
      >
        <ChevronLeft className="w-4 h-4" />
        Retour à la liste
      </Link>

      {/* Bandeau d'identité, calqué sur les fiches de l'application (élève,
          enseignant, utilisateur) : le logo tient lieu d'avatar, le nom est le
          `h1`, et les repères tiennent sur la ligne du dessous. */}
      <div className="flex items-center gap-3">
        {ecole.logo_url ? (
          <Image
            src={ecole.logo_url}
            alt=""
            width={44}
            height={44}
            unoptimized
            className="w-11 h-11 rounded-xl object-contain flex-shrink-0 bg-[#ffffff] ring-1 ring-warm-200"
          />
        ) : (
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none bg-warm-100 text-warm-700 ring-1 ring-warm-200">
            {(ecole.nom ?? '?').trim().charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <h1 className="text-lg font-bold text-secondary-800 leading-tight truncate">{ecole.nom}</h1>
          <div className="flex items-center gap-2 text-xs text-warm-700 mt-0.5 flex-wrap">
            <span className="font-mono">{ecole.slug}.bilaleducation.fr</span>
            <span aria-hidden="true">·</span>
            {ecole.is_active
              ? <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded font-medium">Actif</span>
              : <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Accès coupé</span>}
          </div>
        </div>

        {/* Compteurs : des nombres seuls ne méritaient pas des cartes pleine largeur. */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {compteurs.map(c => (
            <div
              key={c.label}
              className={`card px-3 py-1.5 text-center min-w-[84px] ${c.facturable ? 'ring-2 ring-primary-600' : ''}`}
            >
              <p className={`text-base font-bold leading-none tabular-nums ${c.facturable ? 'text-primary-700' : 'text-secondary-800'}`}>
                {c.value ?? '?'}
              </p>
              <p className="stat-label mt-1 whitespace-nowrap">{c.label}</p>
            </div>
          ))}

          {/* Entrer depuis la fiche : c'est ici qu'on constate le problème d'un
              client, donc ici qu'on veut y aller — plutôt que de revenir à la
              liste pour retrouver la même ligne. */}
          <div className="ml-2">
            <EnterButton
              id={ecole.id}
              slug={ecole.slug}
              nom={ecole.nom}
              disabled={interventionAilleurs}
              dejaOuverte={moi?.etablissement_id === id}
              taille="sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 items-start">
        <EcoleInfoForm ecole={ecole} notes={notesRow?.notes ?? ''} />
        <EcoleUsersSection profiles={profiles ?? []} etablissementId={id} etablissementNom={ecole.nom} />
      </div>

    </div>
  )
}
