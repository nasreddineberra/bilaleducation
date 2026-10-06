'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'

/**
 * « Une nouvelle version est disponible. »
 *
 * ── LE DEFAUT QU'ELLE PREVIENT ─────────────────────────────────────────────
 *
 * Next donne a chaque server action un identifiant PROPRE AU BUILD, embarque
 * dans le bundle du navigateur. Apres un deploiement, un onglet reste ouvert
 * cite un identifiant que la nouvelle version ne connait plus : React leve
 * « An unexpected response was received from the server. », nos `catch`
 * l'affichent telle quelle, et l'utilisateur lit une phrase anglaise
 * incomprehensible en croyant avoir perdu sa saisie. Vecu le 06/10.
 *
 * Mesure du jour : **67 server actions dans 19 modules** — pratiquement toute
 * ecriture de l'application. Et **203 points d'affichage d'erreur dans 41
 * fichiers**, ce qui condamne l'idee « il suffit de traduire le message » :
 * il n'y a pas d'entonnoir unique (85 `toast.error`, 118 `setError` locaux).
 *
 * D'ou cette banniere : UN composant, qui previent AVANT que l'utilisateur ne
 * tente d'enregistrer, au lieu d'expliquer apres coup.
 *
 * ── ELLE NE RECHARGE JAMAIS TOUTE SEULE ────────────────────────────────────
 *
 * C'est la regle qui prime sur tout le reste : un rechargement automatique au
 * milieu d'une saisie detruirait precisement ce qu'on cherche a proteger. Elle
 * informe et propose, l'utilisateur choisit son moment.
 *
 * ── CE QUI DECLENCHE LA VERIFICATION ───────────────────────────────────────
 *
 * Pas de sondage serre. On regarde quand l'utilisateur REVIENT a l'onglet
 * (`focus`, `visibilitychange`) — c'est l'instant juste avant qu'il n'agisse,
 * donc le mieux place — avec un garde-fou d'une minute, plus un reveil lent de
 * 20 minutes pour l'onglet qui reste affiche sans jamais perdre le focus.
 *
 * Une fois l'ecart constate, on cesse de verifier : il ne se refermera pas.
 *
 * ── FAIL-OPEN, comme la session (11 aout) ──────────────────────────────────
 *
 * Sans identifiant de build, ou si l'appel echoue (reseau coupe, reponse
 * illisible), on ne montre RIEN. Une banniere affichee a tort ferait recharger
 * pour rien, et userait la confiance qu'on lui accorde le jour ou elle a
 * raison.
 */

const INTERVALLE_LENT_MS = 20 * 60 * 1000
const DELAI_MINIMAL_MS   = 60 * 1000

export default function NouvelleVersion() {
  const monBuild = process.env.NEXT_PUBLIC_BUILD_ID ?? ''
  const [nouvelle, setNouvelle] = useState(false)
  const [masquee, setMasquee]   = useState(false)
  const dernierTest = useRef(0)

  const verifier = useCallback(async () => {
    if (!monBuild) return
    const maintenant = Date.now()
    if (maintenant - dernierTest.current < DELAI_MINIMAL_MS) return
    dernierTest.current = maintenant

    try {
      const r = await fetch('/api/version', { cache: 'no-store' })
      if (!r.ok) return
      const { build } = await r.json() as { build?: string }
      // On n'alerte que sur un ecart FRANC : une valeur vide signifie que le
      // serveur ne sait pas, pas qu'il a change.
      if (build && build !== monBuild) setNouvelle(true)
    } catch {
      // Reseau coupe, reponse illisible : on se tait. Voir « fail-open ».
    }
  }, [monBuild])

  useEffect(() => {
    if (!monBuild || nouvelle) return

    const auRetour = () => { if (document.visibilityState === 'visible') verifier() }
    window.addEventListener('focus', auRetour)
    document.addEventListener('visibilitychange', auRetour)
    const minuterie = setInterval(auRetour, INTERVALLE_LENT_MS)

    return () => {
      window.removeEventListener('focus', auRetour)
      document.removeEventListener('visibilitychange', auRetour)
      clearInterval(minuterie)
    }
  }, [monBuild, nouvelle, verifier])

  if (!nouvelle || masquee) return null

  return (
    <div
      role="status"
      className="flex items-center gap-2.5 px-3 sm:px-5 lg:px-8 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs"
    >
      <RefreshCw size={14} className="shrink-0" />
      <p className="flex-1 min-w-0">
        Une nouvelle version de l’application est disponible.{' '}
        <span className="hidden sm:inline">Rechargez la page pour en bénéficier.</span>
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 px-2.5 py-1 rounded-lg font-semibold bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
      >
        Recharger
      </button>
      {/* MASQUABLE, a dessein : l'utilisateur peut etre au milieu d'une longue
          saisie et vouloir s'en debarrasser. Il a ete prevenu ; l'enfermer
          derriere un bandeau qu'il ne peut pas retirer serait pire. */}
      <button
        type="button"
        onClick={() => setMasquee(true)}
        aria-label="Masquer cet avis"
        className="shrink-0 p-1 rounded hover:bg-amber-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50"
      >
        <X size={14} />
      </button>
    </div>
  )
}
