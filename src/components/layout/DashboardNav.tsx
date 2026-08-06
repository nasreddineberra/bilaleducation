'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Power, Bell, ChevronRight, Sun, Moon } from 'lucide-react'
import { clsx } from 'clsx'

import { useSidebar } from './SidebarContext'
import { useTheme } from './ThemeContext'
import Tooltip from '@/components/ui/Tooltip'
import SupportBanner from './SupportBanner'
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
  '/dashboard/financements/vue-globale': 'Statistiques sur règlements',
  '/dashboard/etablissement':     'Établissement',
  '/dashboard/utilisateurs':      'Utilisateurs',
  '/dashboard/annee-scolaire':    'Années scolaires',
  '/dashboard/annee-scolaire/new':'Nouvelle année scolaire',
  '/dashboard/cours':             'Référentiel des cours',
  '/dashboard/cotisations':       'Financiers',
  '/dashboard/types-presence':   'Types de présence',
  '/dashboard/ressources':        'Ressources',
  '/dashboard/logs':              'Journal d\'activité',
  '/dashboard/emploi-du-temps':   'Emploi du temps',
  '/dashboard/cahier-texte':      'Cahier de texte',
  '/dashboard/cahier-texte/new':  'Nouvelle séance',
  '/dashboard/mon-compte':        'Mon compte',
}

function getInitiales(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.[0]?.toUpperCase() ?? ''
  const l = lastName?.[0]?.toUpperCase() ?? ''
  return f + l || '?'
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

type Crumb = { label: string }

function getBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/dashboard') return [{ label: 'Tableau de bord' }]

  // Sous-pages apprenants
  if (/^\/dashboard\/students\/new/.test(pathname))
    return [{ label: 'Apprenants' }, { label: 'Nouvel apprenant' }]
  if (/^\/dashboard\/students\//.test(pathname))
    return [{ label: 'Apprenants' }, { label: 'Fiche apprenant' }]

  // Sous-pages parents
  if (/^\/dashboard\/parents\/new/.test(pathname))
    return [{ label: 'Parents & Responsables' }, { label: 'Nouveau parent' }]
  if (/^\/dashboard\/parents\//.test(pathname))
    return [{ label: 'Parents & Responsables' }, { label: 'Fiche parent' }]

  // Sous-pages enseignants
  if (/^\/dashboard\/teachers\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Enseignants' }, { label: 'Nouvel enseignant' }]
  if (/^\/dashboard\/teachers\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Enseignants' }, { label: 'Fiche enseignant' }]

  // Sous-pages utilisateurs
  if (/^\/dashboard\/utilisateurs\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Utilisateurs' }, { label: 'Nouvel utilisateur' }]
  if (/^\/dashboard\/utilisateurs\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Utilisateurs' }, { label: 'Utilisateur' }]

  // Sous-pages classes (sous Paramètres > Pédagogie)
  if (/^\/dashboard\/classes\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Classes' }, { label: 'Nouvelle classe' }]
  if (/^\/dashboard\/classes\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Classes' }, { label: 'Fiche classe' }]

  // Sous-pages année scolaire
  if (/^\/dashboard\/annee-scolaire\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Année scolaire' }, { label: 'Nouvelle année' }]
  if (/^\/dashboard\/annee-scolaire\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Année scolaire' }, { label: 'Détail' }]

  // Sous-pages notifications
  if (/^\/dashboard\/notifications\//.test(pathname))
    return [{ label: 'Notifications' }, { label: 'Détail' }]

  // Sous-pages cahier de texte
  if (/^\/dashboard\/cahier-texte\/new/.test(pathname))
    return [{ label: 'Cahier de texte' }, { label: 'Nouvelle séance' }]
  if (/^\/dashboard\/cahier-texte\//.test(pathname))
    return [{ label: 'Cahier de texte' }, { label: 'Séance' }]

  // Communications
  if (/^\/dashboard\/communications\/new/.test(pathname))
    return [{ label: 'Communications' }, { label: 'Nouveau message' }]
  if (/^\/dashboard\/communications\/staff/.test(pathname))
    return [{ label: 'Communications' }, { label: 'Staff interne' }]
  if (/^\/dashboard\/communications\//.test(pathname))
    return [{ label: 'Communications' }, { label: 'Message' }]
  if (pathname === '/dashboard/communications')
    return [{ label: 'Communications' }, { label: 'Messages envoyés' }]

  // Financements
  if (/^\/dashboard\/financements\/reglements/.test(pathname))
    return [{ label: 'Financements' }, { label: 'Règlements' }]
  if (/^\/dashboard\/financements\/vue-globale/.test(pathname))
    return [{ label: 'Financements' }, { label: 'Statistiques sur règlements' }]
  if (pathname === '/dashboard/financements')
    return [{ label: 'Financements' }, { label: 'Situation financière' }]

  // Affectations
  if (/^\/dashboard\/affectation\/adultes/.test(pathname))
    return [{ label: 'Affectations' }, { label: 'Adultes' }]
  if (pathname === '/dashboard/affectation')
    return [{ label: 'Affectations' }, { label: 'Apprenants' }]

  // Évaluations
  if (pathname === '/dashboard/evaluations')
    return [{ label: 'Évaluations' }, { label: 'Gabarits' }]
  if (pathname === '/dashboard/grades')
    return [{ label: 'Évaluations' }, { label: 'Saisie notes' }]
  if (pathname === '/dashboard/bulletins')
    return [{ label: 'Évaluations' }, { label: 'Bulletins' }]

  // Pages sous Paramètres > Pédagogie (3 niveaux)
  if (pathname === '/dashboard/classes')
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Param. Classes' }]
  if (pathname === '/dashboard/cours')
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Référentiel Cours' }]

  // Pages Paramètres niveau 1 (2 niveaux)
  const paramsPages: Record<string, string> = {
    '/dashboard/teachers':       'Enseignants',
    '/dashboard/utilisateurs':   'Utilisateurs',
    '/dashboard/annee-scolaire': 'Années scolaires',
    '/dashboard/cotisations':    'Financiers',
    '/dashboard/types-presence': 'Types de présence',
    '/dashboard/ressources':     'Ressources',
    '/dashboard/logs':           'Journal d\'activité',
    '/dashboard/etablissement':  'Établissement',
  }
  if (paramsPages[pathname])
    return [{ label: 'Paramètres' }, { label: paramsPages[pathname] }]

  // Pages directes connues (menu direct, pas de groupe parent)
  const title = EXACT_TITLES[pathname]
  if (title) return [{ label: title }]

  return [{ label: 'Tableau de bord' }]
}

function getPageTitle(pathname: string): string {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname]
  if (/^\/dashboard\/students\//.test(pathname))       return 'Fiche apprenant'
  if (/^\/dashboard\/parents\//.test(pathname))        return 'Fiche parent'
  if (/^\/dashboard\/teachers\//.test(pathname))       return 'Fiche enseignant'
  if (/^\/dashboard\/utilisateurs\//.test(pathname))   return 'Utilisateur'
  if (/^\/dashboard\/notifications\//.test(pathname))  return 'Notification'
  if (/^\/dashboard\/classes\//.test(pathname))        return 'Fiche classe'
  if (/^\/dashboard\/annee-scolaire\//.test(pathname)) return 'Année scolaire'
  return 'Tableau de bord'
}

// ─── Composant ────────────────────────────────────────────────────────────

interface DashboardNavProps {
  user: SupabaseUser
  profile: Profile | null
  unreadNotifCount?: number
  /** Nom de l'école pendant une intervention de support, sinon `null`. */
  supportEcole?: string | null
}

export default function DashboardNav({ user, profile, unreadNotifCount = 0, supportEcole = null }: DashboardNavProps) {
  const router    = useRouter()
  const pathname  = usePathname()
  const { collapsed } = useSidebar()
  const { theme, toggle } = useTheme()

  const doLogout = async (reason?: 'inactivity') => {
    try {
      await authRepository.signOut()
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
    // Navigation dure pour purger tout le state React/Supabase en cache
    window.location.href = reason ? `/login?reason=${reason}` : '/login'
  }

  // Déconnexion manuelle : pas de message ; inactivité : message dédié.
  const handleLogout = () => doLogout()
  useInactivityLogout(() => doLogout('inactivity'))

  return (
    <nav className="h-[61px] flex items-center bg-white dark:bg-[var(--brand-surface-2)] border-b border-warm-200 dark:border-[#243139] shadow-nav dark:shadow-none px-6 sticky top-0 z-30">
      {/* `relative` : ancre du rappel d'intervention, centré en absolu. */}
      <div className="relative w-full flex items-center justify-between">

        {/* Titre + Breadcrumb */}
        <div className="hidden md:flex flex-col justify-center">
          {collapsed ? (
            (() => {
              const crumbs = getBreadcrumbs(pathname)
              return crumbs.length > 1 ? (
                <>
                  <nav className="flex items-center gap-1 mb-0.5">
                    {crumbs.map((crumb, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight size={11} className="text-warm-700 dark:text-[#8b9aa0] flex-shrink-0" />}
                        <span className={i === crumbs.length - 1 ? 'text-xs text-warm-700 dark:text-[#8b9aa0]' : 'text-xs text-warm-700 dark:text-[#8b9aa0]'}>
                          {crumb.label}
                        </span>
                      </span>
                    ))}
                  </nav>
                  <h1 className="text-lg font-bold text-secondary-800 dark:text-[#e7eef0] leading-tight">{getPageTitle(pathname)}</h1>
                </>
              ) : (
                <h1 className="text-xl font-bold text-secondary-800 dark:text-[#e7eef0]">{getPageTitle(pathname)}</h1>
              )
            })()
          ) : (
            <h1 className="text-xl font-bold text-secondary-800 dark:text-[#e7eef0]">{getPageTitle(pathname)}</h1>
          )}
        </div>

        {/* Intervention de support : au centre, entre le titre et les commandes.
            L'espace y est libre, et le rappel ne prend rien à la zone de contenu. */}
        {supportEcole && <SupportBanner ecole={supportEcole} />}

        <div className="flex items-center gap-3 ml-auto">
          {/* Bascule thème clair / sombre — sélecteur segmenté */}
          <div
            role="group"
            aria-label="Thème de l'interface"
            className="flex items-center gap-0.5 p-0.5 rounded-full bg-warm-100 dark:bg-white/5 border border-warm-200 dark:border-white/10"
          >
            <Tooltip content="Thème clair" position="bottom">
            <button
              type="button"
              onClick={() => { if (theme !== 'light') toggle() }}
              aria-label="Thème clair"
              aria-pressed={theme === 'light'}
              className={clsx(
                'flex items-center justify-center w-7 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                theme === 'light'
                  ? 'bg-white text-[var(--brand-surface)] shadow-sm'
                  : 'text-secondary-400 dark:text-[#8b9aa0] hover:text-secondary-600 dark:hover:text-white',
              )}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            </Tooltip>
            <Tooltip content="Thème sombre" position="bottom">
            <button
              type="button"
              onClick={() => { if (theme !== 'dark') toggle() }}
              aria-label="Thème sombre"
              aria-pressed={theme === 'dark'}
              className={clsx(
                'flex items-center justify-center w-7 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                theme === 'dark'
                  ? 'bg-[#0e1418] text-[var(--brand-accent)] shadow-sm'
                  : 'text-[var(--brand-surface)] hover:text-[var(--brand-surface-2)]',
              )}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            </Tooltip>
          </div>

          {/* Notifications */}
          <Tooltip content={unreadNotifCount > 0 ? `Notifications (${unreadNotifCount} non lues)` : 'Notifications'} position="bottom">
          <Link
            href="/dashboard/notifications"
            className="relative p-2 text-[var(--brand-surface)] hover:text-[var(--brand-surface-2)] hover:bg-warm-100 dark:text-[#8b9aa0] dark:hover:text-white dark:hover:bg-white/10 rounded-xl transition-all duration-200"
            aria-label={unreadNotifCount > 0 ? `Notifications (${unreadNotifCount} non lues)` : 'Notifications'}
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white px-1">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </Link>
          </Tooltip>

          {/* Déconnexion — juste après les notifications */}
          <Tooltip content="Déconnexion" position="bottom">
          <button
            onClick={handleLogout}
            className="relative p-2 text-[var(--brand-surface)] hover:text-[var(--brand-surface-2)] hover:bg-warm-100 dark:text-[#8b9aa0] dark:hover:text-white dark:hover:bg-white/10 rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            aria-label="Déconnexion"
          >
            <Power className="w-5 h-5" />
          </button>
          </Tooltip>

          {/* Séparateur */}
          <div className="w-px h-6 bg-warm-200 dark:bg-[#243139]" />

          {/* Profil utilisateur → Mon compte */}
          <Tooltip content="Mon compte" position="bottom">
          <Link
            href="/dashboard/mon-compte"
            aria-label="Mon compte"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-secondary-800 dark:text-[#e7eef0] leading-tight">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-warm-700 dark:text-[#8b9aa0] capitalize leading-tight mt-0.5">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
            {/* Avatar rond : fond = 1re couleur du thème, bord = 3e (accent) */}
            <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-sm font-bold text-sm text-white select-none flex-shrink-0 bg-[var(--brand-surface)] ring-2 ring-[var(--brand-accent)]">
              {getInitiales(profile?.first_name, profile?.last_name)}
            </div>
          </Link>
          </Tooltip>
        </div>
      </div>
    </nav>
  )
}
