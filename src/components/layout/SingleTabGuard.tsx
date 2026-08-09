'use client'

import { useEffect, useState, useRef } from 'react'

/**
 * Interdit l'ouverture de l'application dans plusieurs onglets.
 *
 * ┌─ POURQUOI ──────────────────────────────────────────────────────────────┐
 * │ Chaque onglet portait son PROPRE minuteur d'inactivité, sans            │
 * │ coordination. Deux onglets ouverts, on travaille dans le premier : le    │
 * │ second, resté en arrière-plan, n'a rien reçu, son minuteur expire et     │
 * │ déclenche la déconnexion. Or `signOut` efface les cookies pour tout le   │
 * │ domaine — l'utilisateur est éjecté de l'onglet où il travaillait.        │
 * │                                                                          │
 * │ Décision : plutôt que de faire dialoguer les minuteurs, n'autoriser      │
 * │ qu'un seul onglet. Une session, un endroit.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * MÉCANIQUE. `BroadcastChannel` est le canal entre onglets d'une même origine.
 * Au montage, l'onglet demande « qui est là ? ». Si un autre répond, il se sait
 * en double et affiche l'écran de blocage. Le canal étant lié à l'ORIGINE, la
 * console (`superadmin.…`) et une école ne se gênent jamais.
 *
 * ON NE PIÈGE PERSONNE. L'onglet bloqué propose de « prendre la main » : ouvrir
 * un lien dans un nouvel onglet est un réflexe courant, et refuser sans issue
 * ferait chercher longtemps. C'est alors l'autre onglet qui passe en blocage.
 */

const CANAL = 'bilal-onglet-unique'

/** Un onglet qui se ferme prévient : les bloqués peuvent reprendre la main. */
type Message =
  | { type: 'qui-est-la'; id: string }
  | { type: 'je-suis-la'; id: string }
  | { type: 'je-prends-la-main'; id: string }
  | { type: 'je-pars'; id: string }

export default function SingleTabGuard({ children }: { children: React.ReactNode }) {
  const [bloque, setBloque] = useState(false)
  const idRef = useRef<string>('')
  const canalRef = useRef<BroadcastChannel | null>(null)
  const bloqueRef = useRef(false)
  bloqueRef.current = bloque

  useEffect(() => {
    // `BroadcastChannel` manque à quelques navigateurs anciens. On laisse alors
    // passer : mieux vaut deux onglets qu'une application inutilisable.
    if (typeof BroadcastChannel === 'undefined') return

    const id = Math.random().toString(36).slice(2)
    idRef.current = id
    const canal = new BroadcastChannel(CANAL)
    canalRef.current = canal

    canal.onmessage = (e: MessageEvent<Message>) => {
      const msg = e.data
      if (!msg || msg.id === id) return

      switch (msg.type) {
        case 'qui-est-la':
          // Seul un onglet ACTIF répond : sinon deux onglets bloqués se
          // renverraient l'un à l'autre une présence qu'aucun n'assume.
          if (!bloqueRef.current) canal.postMessage({ type: 'je-suis-la', id })
          break

        case 'je-suis-la':
          setBloque(true)
          break

        case 'je-prends-la-main':
          // Un autre onglet réclame la main : on lui cède.
          setBloque(true)
          break

        case 'je-pars':
          // La place est libre. Un onglet bloqué la reprend sans rien demander.
          if (bloqueRef.current) setBloque(false)
          break
      }
    }

    canal.postMessage({ type: 'qui-est-la', id })

    // `pagehide` plutôt que `beforeunload` : c'est le seul événement fiable sur
    // mobile, où l'onglet peut être mis en cache sans jamais « décharger ».
    const partir = () => {
      if (!bloqueRef.current) canal.postMessage({ type: 'je-pars', id })
    }
    window.addEventListener('pagehide', partir)

    return () => {
      partir()
      window.removeEventListener('pagehide', partir)
      canal.close()
    }
  }, [])

  function prendreLaMain() {
    canalRef.current?.postMessage({ type: 'je-prends-la-main', id: idRef.current })
    setBloque(false)
  }

  if (!bloque) return <>{children}</>

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(145deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
      role="alertdialog"
      aria-labelledby="onglet-unique-titre"
    >
      <div
        className="bg-white dark:bg-[#161f24] rounded-3xl p-8 w-full max-w-md text-center"
        style={{ boxShadow: '0 24px 64px rgba(17,28,33,0.22), 0 8px 24px rgba(17,28,33,0.12)' }}
      >
        <h1 id="onglet-unique-titre" className="text-xl font-bold text-secondary-800 dark:text-[#e7eef0] mb-3">
          Déjà ouverte dans un autre onglet
        </h1>
        <p className="text-sm text-warm-700 dark:text-[#93a2a8] leading-relaxed mb-6">
          L&apos;application ne fonctionne que dans un seul onglet à la fois. Revenez à
          celui qui est déjà ouvert, ou continuez ici — l&apos;autre sera alors mis en
          attente.
        </p>
        <button
          type="button"
          onClick={prendreLaMain}
          className="w-full py-3 px-4 rounded-xl bg-primary-500 text-white text-base font-semibold hover:bg-primary-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Continuer dans cet onglet
        </button>
      </div>
    </div>
  )
}
