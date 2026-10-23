'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Power } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { APP_VERSION } from '@/lib/app-version'
import Tooltip from '@/components/ui/Tooltip'
import Onglets, { classeOnglet } from '@/components/ui/Onglets'
import { PastilleConsole } from '@/components/superadmin/MarqueConsole'
import RechercheConsole, { type EcoleRecherche } from '@/components/superadmin/RechercheConsole'

/**
 * Navigation de la CONSOLE (refonte du 22/10, maquette G) : remplace la barre
 * laterale par deux bandes pleine largeur. En haut, la bande graphite (marque,
 * recherche globale, identite, version, deconnexion) ; dessous, les rubriques
 * avec les MEMES onglets que l'application (fiche apprenant), demande du 22/10.
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

export default function ConsoleBarre({ nom, ecoles, runtime }: {
  /** NOM Prénom de l'éditeur connecté : une identité, pas un identifiant de connexion. */
  nom?: string
  /** Toutes les écoles, pour la recherche globale. */
  ecoles: EcoleRecherche[]
  /** `process.version` du serveur (ex. « v24.22.1 »). */
  runtime?: string
}) {
  const pathname = usePathname()
  const actifIndex = RUBRIQUES.findIndex(r => r.actif(pathname))

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
      <div className="h-16 flex items-center gap-4 px-4 sm:px-10 bg-[var(--brand-surface)]">
        <Link
          href="/superadmin"
          className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
        >
          <Image src="/icon.png" alt="" width={36} height={36} unoptimized className="flex-shrink-0" />
          <span className="text-lg font-bold uppercase tracking-wide text-white whitespace-nowrap">Bilal Education</span>
        </Link>
        <PastilleConsole>Console</PastilleConsole>

        <div className="hidden md:flex flex-1 justify-center px-4">
          <RechercheConsole ecoles={ecoles} />
        </div>

        <div className="ml-auto md:ml-0 flex items-center gap-3 min-w-0">
          <span className="hidden sm:block text-xs text-[var(--brand-text)] truncate">{nom}</span>
          {/* Version de Node.js EXECUTEE par le serveur (23/10, faille Brotli
              CVE-2026-111497) : la branche est fixee par `engines`, le correctif
              est celui que Vercel deploie. Visible de l'editeur seul. */}
          <Tooltip content={runtime ? `Node.js ${runtime}` : 'Version de Node.js inconnue'} position="bottom">
            <span tabIndex={0} className="mono text-[11px] leading-none text-[var(--brand-muted)] bg-white/10 px-1.5 py-1 rounded flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]">
              {APP_VERSION}
            </span>
          </Tooltip>
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

      <nav aria-label="Navigation de la console" className="px-4 sm:px-10 pt-2 bg-[var(--surface-card)]">
        <Onglets navigation ariaLabel="Navigation de la console" actifIndex={actifIndex}>
          {RUBRIQUES.map((r, i) => (
            <Link
              key={r.href}
              href={r.href}
              data-onglet
              aria-current={i === actifIndex ? 'page' : undefined}
              className={classeOnglet(i === actifIndex)}
            >
              {r.libelle}
            </Link>
          ))}
        </Onglets>
      </nav>
    </header>
  )
}
