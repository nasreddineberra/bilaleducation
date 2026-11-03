'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FloatButton, SearchField } from '@/components/ui/FloatFields'
import { useToast } from '@/lib/toast-context'
import { messageErreur } from '@/lib/erreur'
import { afficherPdf, fermerOngletPdf, ouvrirOngletPdf } from '@/lib/pdf/ouvrir'
import { ORDRE_MODULES, rechercher } from '@/lib/aide'
import type { Procedure, OptionsEcole } from '@/lib/aide/types'

/** Menu Aide : les procedures du role, par module du menu, avec recherche et guide PDF. */
export default function AideClient({ procedures, etablissement, options }: { procedures: Procedure[]; etablissement: string; options: OptionsEcole }) {
  const { error: toastError } = useToast()
  const [requete, setRequete] = useState('')
  const [pdfEnCours, setPdfEnCours] = useState(false)

  const trouvees = useMemo(() => rechercher(procedures, requete), [procedures, requete])
  const parModule = ORDRE_MODULES
    .map(m => ({ module: m, liste: trouvees.filter(p => p.module === m) }))
    .filter(g => g.liste.length > 0)

  const ouvrirGuide = async () => {
    const onglet = ouvrirOngletPdf()   // AU CLIC, avant tout await
    setPdfEnCours(true)
    try {
      const { genererGuidePdf } = await import('./guidePdf')
      afficherPdf(await genererGuidePdf(procedures, etablissement, options), 'Guide_utilisation.pdf', onglet)
    } catch (e) {
      fermerOngletPdf(onglet)
      toastError(messageErreur(e) ?? 'Le guide n’a pas pu être généré.')
    } finally {
      setPdfEnCours(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3 flex-shrink-0">
        <SearchField value={requete} onChange={setRequete} placeholder="Rechercher dans l’aide…" ariaLabel="Rechercher dans l’aide" className="w-full sm:w-80" />
        <div className="ml-auto">
          <FloatButton variant="secondary" size="mini" loading={pdfEnCours} disabled={pdfEnCours || procedures.length === 0} onClick={ouvrirGuide}>
            Guide PDF
          </FloatButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto list-scroll space-y-4">
        {procedures.length === 0 ? (
          <p className="card text-center text-sm text-warm-700 py-10">Aucune procédure pour le moment.</p>
        ) : parModule.length === 0 ? (
          <p className="card text-center text-sm text-warm-700 py-10">Aucune procédure ne correspond à la recherche.</p>
        ) : parModule.map(g => (
          <section key={g.module} className="space-y-2">
            <h2 className="section-title">{g.module}</h2>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {g.liste.map(p => (
                <li key={p.slug}>
                  <Link
                    href={`/dashboard/aide/${p.slug}`}
                    className="card p-3 h-full flex flex-col gap-1 hover:border-[var(--brand-line)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                  >
                    <span className="text-sm font-semibold text-[var(--brand-surface)] dark:text-[var(--brand-accent)]">{p.titre}</span>
                    <span className="text-xs text-warm-700 leading-relaxed">{p.resume}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
