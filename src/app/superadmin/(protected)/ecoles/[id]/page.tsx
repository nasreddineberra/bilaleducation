import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
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

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .eq('etablissement_id', id)
    .order('last_name', { ascending: true })

  const [{ count: studentsCount }, { count: classesCount }] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('etablissement_id', id),
    supabase.from('classes').select('id', { count: 'exact', head: true }).eq('etablissement_id', id),
  ])

  const compteurs = [
    { label: 'Utilisateurs', value: profiles?.length ?? 0 },
    { label: 'Élèves',       value: studentsCount ?? 0   },
    { label: 'Classes',      value: classesCount ?? 0    },
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

        {/* Compteurs : trois nombres ne méritaient pas trois cartes pleine largeur. */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {compteurs.map(c => (
            <div key={c.label} className="card px-3 py-1.5 text-center min-w-[84px]">
              <p className="text-base font-bold text-secondary-800 leading-none tabular-nums">{c.value}</p>
              <p className="stat-label mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 items-start">
        <EcoleInfoForm ecole={ecole} />
        <EcoleUsersSection profiles={profiles ?? []} etablissementId={id} />
      </div>

    </div>
  )
}
