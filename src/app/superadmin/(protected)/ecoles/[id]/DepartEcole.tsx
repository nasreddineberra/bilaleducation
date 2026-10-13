'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton, FloatInput } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/lib/toast-context'
import { exporterEcole, simulerEffacement, effacerEcole } from '@/app/superadmin/depart-actions'

/**
 * Départ d'une école (RGPD) : exporter ses données, puis l'effacer.
 *
 * L'effacement exige que l'accès soit DÉJÀ coupé (on n'efface pas une école
 * active par erreur) et la saisie de son adresse. La modale montre d'abord le
 * compte rendu d'une SIMULATION faite en base : ce qui partira, cascades
 * comprises, et non une estimation.
 */
export default function DepartEcole({ etablissementId, slug, nom, actif }: {
  etablissementId: string
  slug: string
  nom: string
  actif: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [exportEnCours, setExportEnCours] = useState(false)
  const [ouverte, setOuverte] = useState(false)
  const [simulation, setSimulation] = useState<{ lignes: Record<string, number>; comptes: number; fichiers: number } | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [saisie, setSaisie] = useState('')
  const [effacement, setEffacement] = useState(false)

  const exporter = async () => {
    // Onglet ouvert AVANT l'attente : après, le navigateur le bloquerait comme
    // une fenêtre surgissante (leçon de l'attestation de paiement).
    const onglet = window.open('', '_blank')
    setExportEnCours(true)
    try {
      const r = await exporterEcole(etablissementId)
      if (r.error || !r.url) { onglet?.close(); toast.error(r.error ?? 'Export impossible.'); return }
      if (onglet) onglet.location.href = r.url
      else window.location.href = r.url
      if (r.manquants) toast.warning(`Export créé, mais ${r.manquants} fichier(s) n'ont pas pu être récupérés (voir le LISEZ-MOI).`)
      else toast.success(`Export créé : ${r.lignes} lignes, ${r.fichiers} fichier(s).`)
      router.refresh()
    } finally {
      setExportEnCours(false)
    }
  }

  const ouvrir = async () => {
    setOuverte(true); setSimulation(null); setErreur(null); setSaisie('')
    const r = await simulerEffacement(etablissementId, slug)
    if (r.error || !r.lignes) { setErreur(r.error ?? 'Simulation impossible.'); return }
    setSimulation({ lignes: r.lignes, comptes: r.comptes ?? 0, fichiers: r.fichiers ?? 0 })
  }

  const effacer = async () => {
    setEffacement(true)
    try {
      const r = await effacerEcole(etablissementId, saisie)
      if (r.error) { setErreur(r.error); return }
      setOuverte(false)
      if (r.avertissement) toast.warning(`École effacée. ${r.avertissement}`)
      else toast.success(`Données de « ${nom} » effacées : ${r.lignes} lignes, ${r.comptes} compte(s), ${r.fichiers} fichier(s).`)
      router.refresh()
    } finally {
      setEffacement(false)
    }
  }

  const total = simulation ? Object.values(simulation.lignes).reduce((a, b) => a + b, 0) : 0
  const tables = simulation ? Object.entries(simulation.lignes).sort((a, b) => b[1] - a[1]) : []

  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs text-secondary-700 font-medium">Départ de l&apos;école</p>
      <div className="flex items-center gap-2">
        <FloatButton type="button" size="mini" variant="secondary" loading={exportEnCours} onClick={exporter}>
          Exporter
        </FloatButton>
        {actif ? (
          <Tooltip content="Coupez d'abord l'accès de l'école.">
            <span>
              <FloatButton type="button" size="mini" variant="danger" disabled>Effacer</FloatButton>
            </span>
          </Tooltip>
        ) : (
          <FloatButton type="button" size="mini" variant="danger" onClick={ouvrir}>Effacer</FloatButton>
        )}
      </div>

      {ouverte && (
        <FormModal
          title="Effacer les données de l'école"
          onClose={() => setOuverte(false)}
          footer={
            <>
              <FloatButton type="button" variant="secondary" onClick={() => setOuverte(false)}>Annuler</FloatButton>
              <FloatButton
                type="button"
                variant="danger"
                loading={effacement}
                disabled={!simulation || saisie.trim() !== slug || effacement}
                onClick={effacer}
              >
                Effacer définitivement
              </FloatButton>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            {erreur && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{erreur}</p>}
            {!simulation && !erreur && <p className="text-warm-700">Simulation en cours…</p>}
            {simulation && (
              <>
                <p className="text-secondary-800">
                  <span className="font-semibold">{nom}</span> : {total} lignes dans {tables.length} tables,{' '}
                  {simulation.comptes} compte(s) de connexion, {simulation.fichiers} fichier(s).
                </p>
                <details className="text-xs text-warm-700">
                  <summary className="cursor-pointer">Détail par table</summary>
                  <ul className="mt-1 max-h-40 overflow-y-auto list-scroll tabular-nums">
                    {tables.map(([t, n]) => (
                      <li key={t} className="flex justify-between px-1"><span>{t}</span><span>{n}</span></li>
                    ))}
                  </ul>
                </details>
                <p className="text-xs text-amber-700 font-medium">
                  L&apos;effacement est définitif. La fiche reste et pourra être rouverte, mais vide. Exportez les données avant de confirmer.
                </p>
                <FloatInput
                  label={`Saisissez « ${slug} » pour confirmer`}
                  value={saisie}
                  onChange={e => setSaisie(e.target.value)}
                  autoComplete="off"
                />
              </>
            )}
          </div>
        </FormModal>
      )}
    </div>
  )
}
