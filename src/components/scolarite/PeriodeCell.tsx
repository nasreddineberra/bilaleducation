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
 * TOUT SUR UNE LIGNE : libellé, moyenne, bulletin, assiduité. Il y a peu à dire
 * par période, l'empiler donnait des colonnes hautes et creuses.
 *
 * Le bulletin est un bouton ICÔNE SEULE — le seul cas où la charte admet une
 * icône sur un bouton. Il porte donc un `aria-label` et une infobulle : sans
 * libellé visible, c'est là que se trouve son nom.
 */

const PERIOD_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

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
  const nomComplet = PERIOD_LABELS[label] ?? label

  return (
    <div className="flex items-center gap-2 rounded-xl border border-warm-200 bg-warm-50/60 px-2.5 py-1.5 whitespace-nowrap">

      {/* Libellé de période : pastille sobre, largeur figée pour que les colonnes
          s'alignent verticalement d'une période à l'autre. */}
      <Tooltip content={nomComplet}>
        <span className="shrink-0 w-7 text-center rounded-md bg-white border border-warm-200 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warm-700">
          {label}
        </span>
      </Tooltip>

      {!archived ? (
        <span className="text-[11px] text-warm-700 italic">Non archivé</span>
      ) : (
        <>
          <span className={clsx(
            'text-sm font-bold tabular-nums leading-none',
            moyenne == null ? 'text-warm-700'
              : moyenne >= 14 ? 'text-primary-700'
              : moyenne >= 10 ? 'text-amber-700'
              : 'text-red-600',
          )}>
            {moyenne != null ? Number(moyenne).toFixed(2) : '·'}
            {moyenne != null && <span className="text-[10px] font-medium text-warm-700">/20</span>}
          </span>

          {filePath && (
            <Tooltip content={`Bulletin · ${nomComplet}`}>
              <button
                type="button"
                onClick={() => ouvrirBulletin(filePath)}
                aria-label={`Ouvrir le bulletin du ${nomComplet}`}
                className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-lg text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <FileDown size={14} aria-hidden="true" />
              </button>
            </Tooltip>
          )}

          {/* Assiduité repoussée à droite : c'est l'information secondaire. */}
          <span className="ml-auto text-[11px] text-warm-700 tabular-nums">
            {abs} abs.{absNJ > 0 && <span className="text-orange-700"> ({absNJ} nj)</span>} · {retards} ret.
          </span>
        </>
      )}
    </div>
  )
}
