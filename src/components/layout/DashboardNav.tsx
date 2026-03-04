'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Bell, User } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import type { Profile } from '@/types/database'
import type { User } from '@supabase/supabase-js'

// ─── Mapping route → titre ─────────────────────────────────────────────────

const EXACT_TITLES: Record<string, string> = {
  '/dashboard':                   'Tableau de bord',
  '/dashboard/students':          'Apprenants',
  '/dashboard/students/new':      'Nouvel apprenant',
  '/dashboard/parents':           'Parents & Responsables',
  '/dashboard/parents/new':       'Nouveau parent',
  '/dashboard/teachers':          'Enseignants',
  '/dashboard/teachers/new':      'Nouvel enseignant',
  '/dashboard/classes':           'Paramétrage des classes',
  '/dashboard/affectation':       'Affectations pédagogiques',
  '/dashboard/classes/new':       'Nouvelle classe',
  '/dashboard/grades':            'Saisie notes',
  '/dashboard/absences':          'Absences',
  '/dashboard/evaluations':       'Élaboration des évaluations',
  '/dashboard/announcements':     'Communications',
  '/dashboard/payments':          'Paiements',
  '/dashboard/etablissement':     'Établissement',
  '/dashboard/utilisateurs':      'Utilisateurs',
  '/dashboard/annee-scolaire':    'Année scolaire',
  '/dashboard/annee-scolaire/new':'Nouvelle année scolaire',
  '/dashboard/cours':             'Référentiel des cours',
}

function getPageTitle(pathname: string): string {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname]
  if (/^\/dashboard\/students\//.test(pathname))       return 'Fiche apprenant'
  if (/^\/dashboard\/parents\//.test(pathname))        return 'Fiche parents'
  if (/^\/dashboard\/teachers\//.test(pathname))       return 'Fiche enseignant'
  if (/^\/dashboard\/utilisateurs\//.test(pathname))   return 'Utilisateur'
  if (/^\/dashboard\/classes\//.test(pathname))        return 'Fiche classe'
  if (/^\/dashboard\/annee-scolaire\//.test(pathname)) return 'Année scolaire'
  return 'Tableau de bord'
}

// ─── Composant ────────────────────────────────────────────────────────────

interface DashboardNavProps {
  user: User
  profile: Profile | null
}

export default function DashboardNav({ user, profile }: DashboardNavProps) {
  const router   = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    try {
      await authRepository.signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
  }

  useInactivityLogout(handleLogout)

  return (
    <nav className="bg-white shadow-nav px-6 py-3 sticky top-0 z-30">
      <div className="flex items-center justify-between">

        {/* Titre de section */}
        <div className="hidden md:flex items-center gap-2">
          <h1 className="text-xl font-bold text-secondary-800">{getPageTitle(pathname)}</h1>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Notifications */}
          <button className="relative p-2 text-secondary-400 hover:text-secondary-600 hover:bg-warm-100 rounded-xl transition-all duration-200">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white" />
          </button>

          {/* Séparateur */}
          <div className="w-px h-6 bg-warm-200" />

          {/* Profil utilisateur */}
          <Link
            href={profile?.id ? `/dashboard/utilisateurs/${profile.id}` : '#'}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-secondary-800 leading-tight">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-warm-500 capitalize leading-tight mt-0.5">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
            <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center ring-2 ring-primary-200 shadow-sm">
              <User className="w-[18px] h-[18px] text-primary-600" />
            </div>
          </Link>

          {/* Déconnexion */}
          <button
            onClick={handleLogout}
            className="p-2 text-warm-500 hover:text-danger-500 hover:bg-danger-50 rounded-xl transition-all duration-200"
            title="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
