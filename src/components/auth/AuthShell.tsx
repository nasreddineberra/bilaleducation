'use client'

import Image from 'next/image'
import { APP_VERSION } from '@/lib/app-version'
import AuthBrandHeader from './AuthBrandHeader'

/**
 * Coque complète des écrans d'authentification : fond de marque, en-tête de
 * l'école, carte, et signature du produit en bas de page.
 *
 * ┌─ POURQUOI ELLE EXISTE ──────────────────────────────────────────────────┐
 * │ Elle était recopiée dans SEPT écrans, et elle avait dérivé. Au 9 août :  │
 * │ quatre gardaient le dégradé EN DUR `#507583 → #18aa99` d'avant la        │
 * │ refonte du 3 août — donc insensible au thème —, un n'avait pas de pied   │
 * │ de page, et six affichaient une pastille « B » générique au lieu du logo │
 * │ de l'école.                                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La répartition haut/bas n'est pas un hasard : le haut appartient à
 * l'ÉTABLISSEMENT — c'est chez lui que l'utilisateur entre — et l'application
 * se signe discrètement en bas. Le pied est ancré à la PAGE et non posé sous la
 * carte : il reste au même endroit quelle que soit la hauteur du contenu.
 */
export default function AuthShell({
  children,
  sousTitre,
}: {
  children: React.ReactNode
  /** Ligne sous le nom de l'établissement. */
  sousTitre?: string
}) {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 pt-12 pb-24"
      // Mêmes JETONS et même angle (145°) que le panneau de marque de la page
      // de connexion. Les jetons suivent le thème — teal en clair, ardoise en
      // sombre — ce qu'une valeur en dur ne fait pas.
      style={{ background: 'linear-gradient(145deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
    >
      <div className="relative w-full max-w-md">
        <AuthBrandHeader sousTitre={sousTitre} />

        <div
          className="bg-white dark:bg-[#161f24] rounded-3xl p-8 animate-fade-in"
          style={{ boxShadow: '0 24px 64px rgba(17,28,33,0.22), 0 8px 24px rgba(17,28,33,0.12)' }}
        >
          {children}
        </div>
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-1.5 px-4">
        <Image src="/icon.png" alt="" width={22} height={22} unoptimized className="opacity-80 flex-shrink-0" />
        <span className="text-white/60 text-xs">
          &copy; Bilal Education &middot; Gestion administrative &amp; pédagogique &middot;
        </span>
        <span className="text-white/50 text-[11px] font-mono bg-white/10 px-1.5 py-0.5 rounded leading-none">
          {APP_VERSION}
        </span>
      </div>
    </div>
  )
}
