import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import EcoleInfoForm from './EcoleInfoForm'
import EcoleUsersSection from './EcoleUsersSection'

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

  return (
    <div className="space-y-6 animate-fade-in">

      <div>
        <nav className="text-xs text-warm-400 mb-2">
          <Link href="/superadmin" className="hover:text-warm-600">Établissements</Link>
          <span className="mx-1.5">/</span>
          <span className="text-secondary-700">{ecole.nom}</span>
        </nav>
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-secondary-800">{ecole.nom}</h1>
            <p className="text-warm-400 text-sm font-mono mt-0.5">{ecole.slug}.bilaleducation.fr</p>
          </div>
          <span className={`ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${ecole.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {ecole.is_active ? 'Actif' : 'Inactif'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Utilisateurs', value: profiles?.length ?? 0 },
          { label: 'Élèves',       value: studentsCount ?? 0   },
          { label: 'Classes',      value: classesCount ?? 0    },
          { label: 'Année',        value: ecole.annee_courante  },
        ].map(stat => (
          <div key={stat.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-secondary-800">{stat.value}</p>
            <p className="text-xs text-warm-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <EcoleInfoForm ecole={ecole} />
        <EcoleUsersSection profiles={profiles ?? []} etablissementId={id} />
      </div>

    </div>
  )
}
