import { createClient } from '@/lib/supabase/server'
import { Users, GraduationCap, BookOpen, ClipboardList } from 'lucide-react'

async function getStats() {
  const supabase = await createClient()

  const [
    { count: studentsCount },
    { count: studentsTotalCount },
    { count: teachersCount },
    { count: teachersTotalCount },
    { count: classesCount },
    { count: activeEnrollments },
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('classes').select('*', { count: 'exact', head: true }),
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  return {
    students: studentsCount || 0,
    studentsTotal: studentsTotalCount || 0,
    teachers: teachersCount || 0,
    teachersTotal: teachersTotalCount || 0,
    classes: classesCount || 0,
    enrollments: activeEnrollments || 0,
  }
}

// Couleurs fixes pour éviter le purge Tailwind des classes dynamiques
const statConfig = [
  {
    key: 'students',
    title: 'Élèves actifs',
    icon: Users,
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    accentBar: 'bg-primary-500',
    change: 'actifs',
  },
  {
    key: 'teachers',
    title: 'Enseignants actifs',
    icon: GraduationCap,
    iconBg: 'bg-secondary-100',
    iconColor: 'text-secondary-600',
    accentBar: 'bg-secondary-500',
    change: 'actifs',
  },
  {
    key: 'classes',
    title: 'Classes',
    icon: BookOpen,
    iconBg: 'bg-success-100',
    iconColor: 'text-success-600',
    accentBar: 'bg-success-500',
    change: 'Année 2025-2026',
  },
  {
    key: 'enrollments',
    title: 'Inscriptions',
    icon: ClipboardList,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    accentBar: 'bg-amber-500',
    change: 'actives',
  },
] as const

const roleLabel: Record<string, string> = {
  admin: 'Administrateur',
  direction: 'Direction',
  comptable: 'Comptable',
  responsable_pedagogique: 'Responsable Pédagogique',
  enseignant: 'Enseignant',
  secretaire: 'Secrétaire',
  parent: 'Parent',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const stats = await getStats()

  return (
    <div className="space-y-8 animate-fade-in">

      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800">
            Bonjour, {profile?.first_name} {profile?.last_name} 👋
          </h1>
          <p className="text-warm-500 mt-1 text-sm">
            {roleLabel[profile?.role ?? ''] ?? profile?.role} · Bilal Education
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-warm-400 bg-white rounded-xl px-4 py-2 shadow-card">
          <span className="w-2 h-2 rounded-full bg-success-500 inline-block" />
          Système opérationnel
        </div>
      </div>

      {/* Statistiques — cards avec barre d'accent en haut */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statConfig.map((cfg) => {
          const Icon = cfg.icon
          const value = stats[cfg.key]
          return (
            <div
              key={cfg.key}
              className="card card-hover relative overflow-hidden"
            >
              {/* Barre colorée en haut */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${cfg.accentBar} rounded-t-2xl`} />

              <div className="flex items-center justify-between pt-2">
                <div>
                  <p className="text-xs font-semibold text-warm-500 uppercase tracking-wider">
                    {cfg.title}
                  </p>
                  <p className="text-3xl font-bold text-secondary-800 mt-2 leading-none">
                    {value}
                  </p>
                  <p className="text-xs text-warm-400 mt-1.5">
                    {cfg.key === 'teachers'
                      ? `${stats.teachersTotal} au total`
                      : cfg.key === 'students'
                      ? `${stats.studentsTotal} au total`
                      : cfg.change}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${cfg.iconBg} shadow-sm flex-shrink-0`}>
                  <Icon className={`w-7 h-7 ${cfg.iconColor}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Contenu inférieur */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Annonces récentes */}
        <div className="card">
          <h2 className="text-base font-bold text-secondary-800 mb-4">Annonces récentes</h2>
          <div className="space-y-3">
            <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-secondary-800 text-sm">Rentrée des classes</p>
                <span className="text-xs text-warm-400 whitespace-nowrap ml-2">Il y a 2 j.</span>
              </div>
              <p className="text-sm text-secondary-600 mt-1">
                La rentrée aura lieu le 1er septembre 2026
              </p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <div className="flex items-start justify-between">
                <p className="font-semibold text-secondary-800 text-sm">Rappel paiement</p>
                <span className="text-xs text-warm-400 whitespace-nowrap ml-2">Il y a 5 j.</span>
              </div>
              <p className="text-sm text-secondary-600 mt-1">
                Les frais de scolarité sont dus avant le 15 mars
              </p>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="card">
          <h2 className="text-base font-bold text-secondary-800 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-2 gap-3">
            {(profile?.role === 'admin' || profile?.role === 'direction' || profile?.role === 'secretaire') && (
              <>
                <button className="btn btn-primary justify-start">Ajouter un élève</button>
                <button className="btn btn-secondary justify-start">Créer une classe</button>
                <button className="btn btn-secondary justify-start">Ajouter un enseignant</button>
                <button className="btn btn-secondary justify-start">Voir les paiements</button>
              </>
            )}
            {profile?.role === 'enseignant' && (
              <>
                <button className="btn btn-primary justify-start">Saisir des notes</button>
                <button className="btn btn-secondary justify-start">Marquer absences</button>
                <button className="btn btn-secondary justify-start">Mes classes</button>
                <button className="btn btn-secondary justify-start">Créer annonce</button>
              </>
            )}
            {profile?.role === 'parent' && (
              <>
                <button className="btn btn-primary justify-start">Voir les notes</button>
                <button className="btn btn-secondary justify-start">Absences</button>
                <button className="btn btn-secondary justify-start">Paiements</button>
                <button className="btn btn-secondary justify-start">Messages</button>
              </>
            )}
            {profile?.role === 'comptable' && (
              <>
                <button className="btn btn-primary justify-start">Gestion paiements</button>
                <button className="btn btn-secondary justify-start">Rapports financiers</button>
                <button className="btn btn-secondary justify-start">Factures</button>
                <button className="btn btn-secondary justify-start">Relances</button>
              </>
            )}
            {profile?.role === 'responsable_pedagogique' && (
              <>
                <button className="btn btn-primary justify-start">Gérer programmes</button>
                <button className="btn btn-secondary justify-start">Suivi pédagogique</button>
                <button className="btn btn-secondary justify-start">Évaluations</button>
                <button className="btn btn-secondary justify-start">Statistiques</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className="card">
        <h2 className="text-base font-bold text-secondary-800 mb-3">Activité récente</h2>
        <div className="py-6 text-center">
          <p className="text-sm text-warm-400">Aucune activité récente pour le moment</p>
        </div>
      </div>

    </div>
  )
}
