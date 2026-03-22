'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Bell, User as UserIcon } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import type { Profile } from '@/types/database'
import type { User as SupabaseUser } from '@supabase/supabase-js'

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
  '/dashboard/affectation':         'Affectations pédagogiques apprenants',
  '/dashboard/affectation/adultes': 'Affectations pédagogiques adultes',
  '/dashboard/classes/new':       'Nouvelle classe',
  '/dashboard/grades':            'Saisie notes',
  '/dashboard/bulletins':          'Bulletins',
  '/dashboard/absences':          'Feuille d\'appel',
  '/dashboard/evaluations':       'Gabarits des évaluations',
  '/dashboard/communications':        'Messages envoyés',
  '/dashboard/communications/new':    'Nouveau message',
  '/dashboard/communications/staff':  'Communication interne',
  '/dashboard/notifications':      'Notifications',
  '/dashboard/temps-presence':     'Temps de presence',
  '/dashboard/financements':              'Situation financière actuelle',
  '/dashboard/financements/reglements':  'Règlements',
  '/dashboard/financements/vue-globale': 'Stats règlements',
  '/dashboard/etablissement':     'Établissement',
  '/dashboard/utilisateurs':      'Utilisateurs',
  '/dashboard/annee-scolaire':    'Année scolaire',
  '/dashboard/annee-scolaire/new':'Nouvelle année scolaire',
  '/dashboard/cours':             'Référentiel des cours',
  '/dashboard/cotisations':       'Financiers',
  '/dashboard/ressources':        'Ressources',
  '/dashboard/logs':              'Journal d\'activité',
  '/dashboard/cahier-texte':      'Cahier de texte',
  '/dashboard/cahier-texte/new':  'Nouvelle séance',
}

function getPageTitle(pathname: string): string {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname]
  if (/^\/dashboard\/students\//.test(pathname))       return 'Fiche apprenant'
  if (/^\/dashboard\/parents\//.test(pathname))        return 'Fiche parents'
  if (/^\/dashboard\/teachers\//.test(pathname))       return 'Fiche enseignant'
  if (/^\/dashboard\/utilisateurs\//.test(pathname))   return 'Utilisateur'
  if (/^\/dashboard\/notifications\//.test(pathname))   return 'Notification'
  if (/^\/dashboard\/classes\//.test(pathname))        return 'Fiche classe'
  if (/^\/dashboard\/annee-scolaire\//.test(pathname)) return 'Année scolaire'
  return 'Tableau de bord'
}

// ─── Composant ────────────────────────────────────────────────────────────

interface DashboardNavProps {
  user: SupabaseUser
  profile: Profile | null
  unreadNotifCount?: number
}

export default function DashboardNav({ user, profile, unreadNotifCount = 0 }: DashboardNavProps) {
  const router   = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    try {
      await authRepository.signOut()
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
    // Navigation dure pour purger tout le state React/Supabase en cache
    window.location.href = '/login'
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
          <Link
            href="/dashboard/notifications"
            className="relative p-2 text-secondary-400 hover:text-secondary-600 hover:bg-warm-100 rounded-xl transition-all duration-200"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white px-1">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </Link>

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
              <UserIcon className="w-[18px] h-[18px] text-primary-600" />
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
