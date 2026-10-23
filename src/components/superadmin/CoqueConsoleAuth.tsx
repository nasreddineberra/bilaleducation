'use client'

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { authRepository } from '@/lib/database/auth'
import MarqueConsole from '@/components/superadmin/MarqueConsole'

/**
 * Ecrans de 2FA de la CONSOLE (refonte du 23/10, maquette I) : le meme ecran
 * graphite que la connexion (`/superadmin/login`), la marque et le formulaire,
 * RIEN d'autre. Ni carte, ni pied de page : la version de l'application y
 * etait affichee, alors qu'un visiteur ne doit rien apprendre de la console.
 *
 * Les ecrans `/auth/totp-challenge` et `/auth/enroll-totp` servent l'ecole ET
 * la console : ils choisissent leur coque avec `useEspaceConsole()`.
 */
export default function CoqueConsoleAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--brand-surface)]">
      <div className="w-full max-w-[360px] flex flex-col items-center gap-9 animate-fade-in">
        <MarqueConsole />
        {children}
      </div>
    </div>
  )
}

/**
 * L'ecran est-il affiche dans la CONSOLE ? Lu sur `data-espace`, que le script
 * de `app/layout.tsx` pose avant tout rendu (sous-domaine ou `?next=/superadmin`).
 * `null` tant que le composant n'est pas monte : `document` n'existe pas au
 * rendu serveur.
 */
export function useEspaceConsole(): boolean | null {
  const [console_, setConsole] = useState<boolean | null>(null)
  useEffect(() => {
    setConsole(document.documentElement.dataset.espace === 'console')
  }, [])
  return console_
}

/** Fond seul, le temps de savoir quelle coque afficher (meme couleur que les deux). */
export function FondAuth() {
  return <div className="min-h-screen bg-[var(--brand-surface)]" />
}

/** Bouton principal citron vert, BORDE (regle du 22/10), celui de la connexion. */
export const BOUTON_CONSOLE =
  'w-full h-[46px] rounded-full text-sm font-bold transition-colors border border-[var(--console-accent-trait)] ' +
  'bg-[var(--console-accent)] text-[var(--console-accent-encre)] hover:bg-[var(--console-accent-2)] outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-[var(--console-accent)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--brand-surface)] disabled:opacity-60 disabled:cursor-not-allowed'

/** Message d'erreur sur fond graphite. */
export function ErreurConsole({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 text-sm text-[var(--console-erreur)]">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/**
 * « Changer de compte » : la session est a mi-parcours (mot de passe valide,
 * 2FA non). On la ferme, puis on revient a la connexion DE LA CONSOLE — et
 * non a `/login`, celle des ecoles. Rechargement complet, comme la
 * deconnexion de `ConsoleBarre`.
 */
export function ChangerDeCompte() {
  const quitter = async () => {
    try { await authRepository.signOut() } catch { /* on quitte quand meme */ }
    window.location.href = '/superadmin/login'
  }
  return (
    <button
      type="button"
      onClick={quitter}
      className="text-[13px] font-medium text-[var(--console-texte-doux)] hover:text-white transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--console-accent)]"
    >
      Changer de compte
    </button>
  )
}
