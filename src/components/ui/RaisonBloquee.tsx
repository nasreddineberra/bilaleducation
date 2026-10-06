'use client'

import { AlertTriangle } from 'lucide-react'

/**
 * La raison pour laquelle un contrôle est grisé, dite EN TEXTE sur petit écran.
 *
 * ── POURQUOI CE COMPOSANT EXISTE ────────────────────────────────────────────
 *
 * Le projet grise un contrôle (plutôt que de le masquer) quand l'action est
 * possible AILLEURS pour cette personne, et confie la raison à une `<Tooltip>`.
 * Sur grand écran c'est le bon dosage : l'explication ne s'affiche qu'à qui la
 * cherche. Sur un téléphone, elle n'existe tout simplement pas — depuis le
 * 5 octobre les infobulles ne se déclenchent plus au doigt (un tap émulait
 * `mouseenter` sans jamais émettre `mouseleave`, la bulle restait collée), et
 * de toute façon un contrôle `disabled` n'émet aucun événement de pointeur.
 * L'utilisateur tape un bouton mort et n'apprend rien.
 *
 * Mesuré le 6 octobre avant d'écrire : sur 184 `<Tooltip>`, 34 habillent un
 * contrôle désactivé, mais **7 seulement** sont sur un écran que le filtre de
 * menu laisse atteindre depuis un téléphone — et le tri en retire encore trois
 * (deux `disabled` transitoires pendant une action, un déjà doublé par une
 * bannière). Ce composant sert les quatre qui restent, pas davantage.
 *
 * ── POURQUOI SOUS LE SEUIL SEULEMENT ────────────────────────────────────────
 *
 * En CSS (`md:hidden`) et non en JS : il n'y a ici ni attribut à piloter ni
 * élément à remplacer, seulement de l'affichage — le JS du hook `usePetitEcran`
 * serait du poids pour rien. Et au-dessus du seuil l'infobulle fait déjà le
 * travail : afficher les deux serait un doublon, que la règle « pas de texte
 * explicatif dans l'UI » proscrit. Ce texte n'est pas une explication oisive,
 * c'est un message d'ÉTAT qui appelle une action, et il disparaît dès que le
 * contrôle redevient actif.
 *
 * ── UTILISATION ─────────────────────────────────────────────────────────────
 *
 * On lui passe la MÊME chaîne qu'à la `<Tooltip>`, pour que les deux ne
 * puissent pas diverger, et `null` quand rien ne bloque :
 *
 *   <Tooltip content={raison ?? 'Imprimer la feuille'}>…</Tooltip>
 *   <RaisonBloquee raison={raison} />
 *
 * `w-full` par défaut : ces contrôles vivent presque toujours dans un groupe
 * `flex flex-wrap`, où la ligne doit occuper sa propre rangée. Sans elle, elle
 * se tasserait à côté des boutons — `flex-wrap` ne replie que ce qui déborde.
 */
export default function RaisonBloquee({
  raison,
  className,
}: {
  /** La raison du blocage, ou `null` si le contrôle est actif. */
  raison: string | null | undefined
  /** Classes supplémentaires (rarement utile ; `w-full` est déjà posé). */
  className?: string
}) {
  if (!raison) return null

  return (
    <p
      role="status"
      className={['md:hidden w-full flex items-start gap-1.5 text-xs text-amber-700', className].filter(Boolean).join(' ')}
    >
      {/* Le pont sombre remappe `text-amber-700` : aucune classe `dark:` à
          écrire ici (vérifié dans globals.css, et non supposé). */}
      <AlertTriangle size={13} className="mt-px shrink-0" />
      <span>{raison}</span>
    </p>
  )
}
