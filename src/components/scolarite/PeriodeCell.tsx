'use client'

import { clsx } from 'clsx'
import { FileDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Tooltip from '@/components/ui/Tooltip'

/**
 * Une période dans l'onglet Scolarité — apprenant ET adulte.
 *
 * Écrite une fois et partagée : les deux fiches affichent rigoureusement la même
 * chose, et ce projet a déjà payé le prix d'un rendu recopié qui dérive.
 *
 * Présentation en PETIT TABLEAU (maquette utilisateur) : une ligne d'intitulés
 * en majuscules, une ligne de valeurs. L'intitulé de la première colonne suit le
 * type de période — SEMESTRE ou TRIMESTRE — et la valeur n'est que son numéro :
 * écrire « S1 » sous un intitulé « SEMESTRE » serait redondant.
 *
 * Le bulletin est un bouton ICÔNE SEULE — le seul cas où la charte admet une
 * icône sur un bouton. Il porte donc un `aria-label` et une infobulle : sans
 * libellé visible, c'est là que se trouve son nom.
 */

export interface PeriodeCellProps {
  /** Libellé court stocké en base (T1, S2…). */
  label: string
  /** `false` = période non archivée : rien à afficher, et surtout pas un zéro. */
  archived: boolean
  moyenne: number | null
  filePath: string | null
  abs: number
  absNJ: number
  retards: number
}

/** « S1 » → intitulé SEMESTRE et valeur 1. Repli sur PÉRIODE si le format change. */
function decouper(label: string): { intitule: string; valeur: string; complet: string } {
  const m = /^([STst])\s*(\d+)$/.exec(label.trim())
  if (!m) return { intitule: 'Période', valeur: label, complet: label }
  const semestre = m[1].toUpperCase() === 'S'
  const intitule = semestre ? 'Semestre' : 'Trimestre'
  return { intitule, valeur: m[2], complet: `${intitule} ${m[2]}` }
}

/** Bucket privé : URL signée à la demande, onglet ouvert AVANT l'await (popup). */
async function ouvrirBulletin(fp: string) {
  const w = window.open('', '_blank')
  const { data, error } = await createClient().storage.from('bulletins').createSignedUrl(fp, 60)
  if (error || !data?.signedUrl) { w?.close(); return }
  w ? (w.location.href = data.signedUrl) : window.open(data.signedUrl, '_blank')
}

export default function PeriodeCell({
  label, archived, moyenne, filePath, abs, absNJ, retards,
}: PeriodeCellProps) {
  const { intitule, valeur, complet } = decouper(label)

  return (
    <div className="rounded-xl border border-warm-200 overflow-hidden">

      {/* Intitulés — même taille que la ligne d'infos de classe, en majuscules. */}
      <div className="grid grid-cols-4 divide-x divide-warm-200 bg-warm-50 text-xs font-semibold uppercase tracking-wide text-warm-700 text-center">
        <span className="px-2 py-1">{intitule}</span>
        <span className="px-2 py-1">Moyenne</span>
        <span className="px-2 py-1">Bulletin</span>
        <span className="px-2 py-1">Discipline</span>
      </div>

      {archived ? (
        <div className="grid grid-cols-4 divide-x divide-warm-200 text-xs text-center">
          <span className="px-2 py-1 font-semibold text-secondary-800 tabular-nums">{valeur}</span>

          <span className={clsx(
            'px-2 py-1 font-bold tabular-nums',
            moyenne == null ? 'text-warm-700'
              : moyenne >= 14 ? 'text-primary-700'
              : moyenne >= 10 ? 'text-amber-700'
              : 'text-red-600',
          )}>
            {moyenne != null ? Number(moyenne).toFixed(2) : '·'}
          </span>

          <span className="px-2 py-1 flex items-center justify-center">
            {filePath ? (
              <Tooltip content={`Bulletin · ${complet}`}>
                <button
                  type="button"
                  onClick={() => ouvrirBulletin(filePath)}
                  aria-label={`Ouvrir le bulletin du ${complet.toLowerCase()}`}
                  className="inline-flex items-center justify-center h-6 w-6 rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  <FileDown size={15} aria-hidden="true" />
                </button>
              </Tooltip>
            ) : (
              <span className="text-warm-700">·</span>
            )}
          </span>

          <span className="px-2 py-1 text-warm-700 tabular-nums">
            {abs} abs.{absNJ > 0 && <span className="text-orange-700"> ({absNJ} nj)</span>} · {retards} ret.
          </span>
        </div>
      ) : (
        /* Période non archivée : une seule cellule, plutôt que quatre remplies de
           zéros qui se liraient comme des chiffres réels. */
        <p className="px-2 py-1 text-xs text-center text-warm-700 italic">Non archivé</p>
      )}
    </div>
  )
}
