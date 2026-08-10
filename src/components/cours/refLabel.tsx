import React from 'react'

/**
 * AFFICHAGE BILINGUE D'UN ÉLÉMENT DU RÉFÉRENTIEL — unité, module ou cours.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────┐
 * │ Ces deux fonctions vivaient EN DOUBLE, mot pour mot, dans les écrans     │
 * │ Gabarits et Saisie des notes : 31 lignes rigoureusement identiques,      │
 * │ vérifiées par `diff`. Changer le séparateur ou la taille de l'arabe dans │
 * │ l'un laissait l'autre en arrière, et l'écart ne se voyait qu'en          │
 * │ comparant les deux écrans côte à côte.                                   │
 * │                                                                          │
 * │ C'est le mécanisme qui avait produit le calcul comptable divergent des   │
 * │ trois sous-menus de Financements, corrigé dans un seul pendant un mois.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

type Item = { nom_fr?: string | null; nom_ar?: string | null } | null | undefined

/**
 * Nom arabe en ligne : police du projet, taille RELATIVE.
 *
 * Relative et non fixe : sans `--font-arabic` il retomberait sur la serif
 * système, et une taille en pixels déséquilibrerait des lignes en `text-xs`.
 * Le facteur 1,45 compense la hauteur de caractères plus faible de l'arabe.
 */
const AR_INLINE: React.CSSProperties = {
  fontFamily: 'var(--font-arabic), sans-serif',
  fontSize: '1.45em',
}

/**
 * Libellé affiché dans l'arbre : « Nom FR · Nom AR ».
 *
 * Rendu INLINE — un fragment, pas un bloc — pour que la troncature du
 * conteneur porte sur l'ensemble plutôt que sur chaque moitié séparément.
 */
export function refLabel(item: Item) {
  const fr = item?.nom_fr?.trim() ?? ''
  const ar = item?.nom_ar?.trim()
  if (!ar) return fr
  return (
    <>
      {fr}
      {fr && <span aria-hidden="true" className="mx-1 text-warm-700">·</span>}
      <span dir="rtl" className="font-normal" style={AR_INLINE}>{ar}</span>
    </>
  )
}

/**
 * Même libellé pour l'infobulle, mais SANS troncature : c'est elle qui donne le
 * nom complet quand la ligne est coupée. D'où `whitespace-nowrap`, et une
 * taille en pixels — la bulle n'hérite d'aucun contexte typographique.
 */
export function refTooltip(item: Item) {
  const fr = item?.nom_fr?.trim()
  const ar = item?.nom_ar?.trim()
  if (!fr && !ar) return ''
  if (!ar) return fr as string
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {fr && <span>{fr}</span>}
      {fr && <span aria-hidden="true">·</span>}
      <span dir="rtl" style={{ fontFamily: 'var(--font-arabic), sans-serif', fontSize: '15px' }}>{ar}</span>
    </span>
  )
}
