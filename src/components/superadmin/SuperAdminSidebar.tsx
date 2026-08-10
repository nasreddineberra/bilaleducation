'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, Activity, Power } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { APP_VERSION } from '@/lib/app-version'
import Tooltip from '@/components/ui/Tooltip'
import TruncatedText from '@/components/ui/TruncatedText'
import { clsx } from 'clsx'

interface SuperAdminSidebarProps {
  /** NOM Prénom de l'éditeur connecté. Pas son adresse : le pied de barre
   *  latérale porte une identité, pas un identifiant de connexion. */
  nom?: string
}

function Item({ href, libelle, icone, actif }: {
  href: string; libelle: string; icone: React.ReactNode; actif: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={actif ? 'page' : undefined}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
        'outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60',
        actif ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white',
      )}
    >
      {icone}
      {libelle}
    </Link>
  )
}

export default function SuperAdminSidebar({ nom }: SuperAdminSidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()

  const handleLogout = async () => {
    try {
      await authRepository.signOut()
      router.push('/superadmin/login')
      router.refresh()
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
  }

  useInactivityLogout(handleLogout)

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-screen overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Image src="/icon.png" alt="" width={36} height={36} unoptimized className="flex-shrink-0 opacity-95" />
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight">Bilal</p>
            <p className="text-orange-400 font-bold text-sm leading-tight">Education</p>
          </div>
        </div>
        <div className="mt-3 px-2 py-1 rounded-lg bg-orange-500/15 inline-block">
          <span className="text-orange-400 text-xs font-semibold tracking-wide uppercase">
            Éditeur
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Navigation de la console">
        <Item
          href="/superadmin"
          libelle="Établissements"
          icone={<Building2 className="w-[18px] h-[18px] flex-shrink-0" />}
          actif={pathname === '/superadmin' || pathname.startsWith('/superadmin/ecoles')}
        />
        <Item
          href="/superadmin/sante"
          libelle="Santé des écoles"
          icone={<Activity className="w-[18px] h-[18px] flex-shrink-0" />}
          actif={pathname.startsWith('/superadmin/sante')}
        />
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────────
          Aligné sur la charte, contrôlée sur les composants de référence et non
          de mémoire : l'icône de déconnexion de l'application est `Power` (et
          non la flèche `LogOut`), tout bouton icône-seule porte un `Tooltip`,
          et les textes secondaires de la barre latérale passent par les jetons
          de marque. Les `text-white/40` et `/50` d'origine étaient sous le seuil
          de lisibilité que la passe du 18 juillet a fixé.

          Le nom est mesuré par `TruncatedText` : l'infobulle n'apparaît que
          s'il est réellement coupé. L'adresse qui figurait ici l'était toujours,
          en plein milieu du domaine, sans aucun moyen de lire la valeur — et
          c'était de toute façon un identifiant de connexion, pas une identité. */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-2 px-2">
          <TruncatedText
            text={nom ?? ''}
            className="flex-1 min-w-0 text-[var(--brand-muted)] text-xs"
          />
          <span className="inline-flex items-center leading-none text-[11px] text-[var(--brand-icon)] font-mono bg-white/10 px-1.5 py-1 rounded flex-shrink-0">
            {APP_VERSION}
          </span>
          {/* Position par défaut (`top`) et surtout PAS `bottom` : ce bouton est
              au ras du bas de l'écran, une bulle posée dessous sort du cadre
              visible. `bottom` ne vaut que pour la barre d'en-tête. */}
          <Tooltip content="Déconnexion">
            <button
              onClick={handleLogout}
              className="p-1.5 text-[var(--brand-icon)] hover:text-white hover:bg-white/10 rounded-lg transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
              aria-label="Déconnexion"
            >
              <Power className="w-[18px] h-[18px]" />
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}
