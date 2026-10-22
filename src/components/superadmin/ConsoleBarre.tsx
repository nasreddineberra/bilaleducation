'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Power } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { APP_VERSION } from '@/lib/app-version'
import Tooltip from '@/components/ui/Tooltip'
import { PastilleConsole } from '@/components/superadmin/MarqueConsole'
import { clsx } from 'clsx'

/**
 * Navigation de la CONSOLE (refonte du 22/10, maquette G) : remplace la barre
 * laterale par deux bandes pleine largeur. En haut, la bande graphite (marque,
 * identite, version, deconnexion) ; dessous, les rubriques en pilules.
 *
 * La version reste affichee ICI et non sur la connexion : derriere
 * l'authentification, elle n'apprend rien a un visiteur.
 */
const RUBRIQUES: { href: string; libelle: string; actif: (p: string) => boolean }[] = [
  { href: '/superadmin',             libelle: 'Établissements',      actif: p => p === '/superadmin' || p.startsWith('/superadmin/ecoles') },
  { href: '/superadmin/sante',       libelle: 'Santé des écoles',    actif: p => p.startsWith('/superadmin/sante') },
  { href: '/superadmin/facturation', libelle: 'Facturation',         actif: p => p.startsWith('/superadmin/facturation') },
  { href: '/superadmin/support',     libelle: 'Demandes de support', actif: p => p.startsWith('/superadmin/support') },
]

export default function ConsoleBarre({ nom }: {
  /** NOM Prénom de l'éditeur connecté : une identité, pas un identifiant de connexion. */
  nom?: string
}) {
  const pathname = usePathname()

  const handleLogout = async () => {
    try {
      await authRepository.signOut()
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
    // NAVIGATION DURE, et HORS du try : motif de `DashboardNav` cote ecole.
    //
    // Deux raisons, et chacune a ete payee. (1) Une navigation souple
    // (`router.push`) ne refait pas de requete complete : le state React et le
    // client Supabase en cache survivent. (2) Elle etait DANS le try, donc un
    // `signOut()` qui echoue laissait l utilisateur sur place, apparemment
    // connecte. On part dans tous les cas — c est la purge serveur sur
    // `/superadmin/login` qui fait le vrai travail.
    window.location.href = '/superadmin/login'
  }

  useInactivityLogout(handleLogout)

  return (
    <header className="flex-shrink-0">
      <div className="h-14 flex items-center gap-3 px-4 sm:px-10 bg-[var(--brand-surface)]">
        <Link
          href="/superadmin"
          className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
        >
          <Image src="/icon.png" alt="" width={30} height={30} unoptimized className="flex-shrink-0" />
          <span className="text-sm font-semibold text-white whitespace-nowrap">Bilal Education</span>
        </Link>
        <PastilleConsole>Console</PastilleConsole>

        <div className="ml-auto flex items-center gap-3 min-w-0">
          <span className="hidden sm:block text-xs text-[var(--brand-text)] truncate">{nom}</span>
          <span className="mono text-[11px] leading-none text-[var(--brand-muted)] bg-white/10 px-1.5 py-1 rounded flex-shrink-0">
            {APP_VERSION}
          </span>
          {/* `bottom` : bouton colle en haut de l'ecran, une bulle au-dessus sortirait du cadre. */}
          <Tooltip content="Déconnexion" position="bottom">
            <button
              onClick={handleLogout}
              aria-label="Déconnexion"
              className="p-1.5 rounded-lg text-[var(--brand-icon)] hover:text-white hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
            >
              <Power className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Sur telephone, les pilules defilent plutot que de passer a la ligne. */}
      <nav
        aria-label="Navigation de la console"
        className="h-[54px] flex items-center gap-1 px-4 sm:px-10 overflow-x-auto bg-[var(--surface-card)] border-b border-[var(--card-border)]"
      >
        {RUBRIQUES.map(r => {
          const actif = r.actif(pathname)
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={actif ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-2 h-[34px] px-3.5 rounded-full text-[13px] whitespace-nowrap transition-colors outline-none',
                'focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]',
                actif
                  ? 'bg-[var(--brand-surface)] text-white font-semibold'
                  : 'text-[var(--ink-muted)] hover:bg-[var(--survol-ligne)] hover:text-[var(--ink)]',
              )}
            >
              {actif && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[var(--brand-accent)]" />}
              {r.libelle}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
