'use client'

import { useEffect, useState } from 'react'

/**
 * LES FILTRES D'UNE LISTE SURVIVENT À L'ALLER-RETOUR VERS UNE FICHE.
 *
 * ── LE DÉFAUT ──────────────────────────────────────────────────────────────
 *
 * On filtre une liste, on ouvre une fiche, on revient : la liste est
 * entièrement défiltrée, et il faut refaire la sélection et la recherche. Sur
 * une liste de 221 apprenants ou 134 foyers, c'est le geste qu'on répète à
 * chaque correction.
 *
 * ── POURQUOI `sessionStorage` ICI, ET L'URL AILLEURS ───────────────────────
 *
 * Trois listes (Apprenants, Parents, Enseignants) filtrent CÔTÉ SERVEUR, avec
 * pagination : leur état vit déjà dans l'URL, et il est transporté jusqu'à la
 * fiche par `lib/navigation/retour`. Ce hook est pour les autres — celles qui
 * filtrent CÔTÉ CLIENT sur un tableau déjà chargé (Utilisateurs, Classes,
 * Notifications), dont l'état n'existe nulle part dans l'URL.
 *
 * L'inverse serait pire des deux côtés : un `sessionStorage` sur une liste à
 * URL ferait rendre la page non filtrée PUIS se rediriger (un clignotement et
 * deux rendus serveur), et porter dans l'URL un filtre purement client
 * exigerait de réécrire le filtrage de trois écrans.
 *
 * Avantage second, et il est réel : la restauration se fait au REMONTAGE du
 * composant, donc elle couvre aussi le bouton Précédent du navigateur, pas
 * seulement le lien « Retour à la liste ». Et elle ne demande AUCUNE
 * modification côté fiche.
 *
 * ── LE PIÈGE, PAYÉ LE 16 JUILLET ───────────────────────────────────────────
 *
 * `hydrate` est un **state** et NON un ref. Un ref passe à `true` dès l'effet
 * de restauration ; l'effet de persistance, dans le MÊME commit, réécrit alors
 * les valeurs par défaut par-dessus le stockage AVANT que les valeurs
 * restaurées ne s'appliquent — et le filtre mémorisé est perdu au montage, ce
 * qui donne l'illusion que la mémorisation ne marche pas. En state, il reste
 * `false` pendant le commit de montage.
 *
 * ── CLÉS CONNUES SEULEMENT ─────────────────────────────────────────────────
 *
 * On ne restaure que les clés présentes dans `defauts`, et seulement si la
 * valeur stockée est une chaîne. Un stockage abîmé, ou écrit par une version
 * antérieure de l'écran, est donc ignoré au lieu d'injecter n'importe quoi dans
 * l'état — c'est la même règle de liste blanche que pour `?from=`.
 *
 * Ce hook garantit « une chaîne », pas « une valeur valide » : un filtre à
 * valeurs énumérées se valide CHEZ L'APPELANT (`f.tab === 'parents' ? … : …`),
 * sinon une valeur bricolée à la main dans le stockage laisserait l'écran sans
 * onglet actif.
 *
 * @param cle     la clé de stockage, propre à l'écran
 * @param defauts l'état initial — il définit AUSSI l'ensemble mémorisé
 * @returns `[etat, majEtat, hydrate]`
 */
export function useFiltresMemorises<T extends Record<string, string>>(
  cle: string,
  defauts: T,
): [T, (maj: Partial<T>) => void, boolean] {
  const [etat, setEtat] = useState<T>(defauts)
  const [hydrate, setHydrate] = useState(false)

  // Restauration au montage.
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(cle)
      if (brut) {
        const stocke = JSON.parse(brut) as Record<string, unknown>
        const retenu: Record<string, string> = {}
        for (const k of Object.keys(defauts)) {
          const v = stocke[k]
          if (typeof v === 'string') retenu[k] = v
        }
        if (Object.keys(retenu).length > 0) {
          setEtat(prev => ({ ...prev, ...retenu }))
        }
      }
    } catch {
      // Navigation privée, stockage bloqué : on garde les filtres par défaut.
      // Le repli est le comportement d'avant, jamais un écran cassé.
    }
    setHydrate(true)
    // `defauts` est un littéral recréé à chaque rendu : le lire ici une seule
    // fois, au montage, est voulu — il ne change jamais de forme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle])

  // Persistance, une fois l'hydratation faite (voir « LE PIÈGE » ci-dessus).
  useEffect(() => {
    if (!hydrate) return
    try {
      sessionStorage.setItem(cle, JSON.stringify(etat))
    } catch {
      // Idem : ne jamais faire échouer l'écran pour une préférence d'affichage.
    }
  }, [cle, hydrate, etat])

  const majEtat = (maj: Partial<T>) => setEtat(prev => ({ ...prev, ...maj }))

  return [etat, majEtat, hydrate]
}
