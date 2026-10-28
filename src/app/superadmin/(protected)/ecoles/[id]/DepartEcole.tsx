'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton } from '@/components/ui/FloatFields'
import SaisieConfirmation from '@/components/ui/SaisieConfirmation'
import { saisieConforme } from '@/lib/texte/saisie-confirmation'
import FormModal from '@/components/ui/FormModal'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/lib/toast-context'
import { exporterEcole, exportExiste, simulerEffacement, effacerEcole } from '@/app/superadmin/depart-actions'
import { pluriel } from '@/lib/texte/pluriel'

/**
 * Départ d'une école (RGPD) : exporter ses données, puis l'effacer.
 *
 * « Effacer » reste GRISÉ tant que les conditions ne sont pas réunies (23/10) :
 * l'accès est coupé (on n'efface pas une école active par erreur) ET un export
 * existe (le ZIP part avec l'effacement : sans export, les données seraient
 * perdues). La modale demande d'abord si le ZIP est enregistré sur l'ordinateur,
 * PUIS montre le compte rendu d'une SIMULATION faite en base (ce qui partira,
 * cascades comprises) et la saisie de l'adresse.
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
  // `null` tant que la verification n'a pas repondu : le bouton reste grise.
  const [exportPret, setExportPret] = useState<boolean | null>(null)
  // Etape de la modale : la question sur le ZIP, puis la confirmation.
  const [zipConfirme, setZipConfirme] = useState(false)

  useEffect(() => {
    exportExiste(etablissementId).then(r => setExportPret(r.existe)).catch(() => setExportPret(false))
  }, [etablissementId])

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
      if (r.manquants) toast.warning(`Export créé, mais ${pluriel(r.manquants, 'fichier')} ${r.manquants > 1 ? 'n’ont pas pu être récupérés' : 'n’a pas pu être récupéré'} (voir le LISEZ-MOI).`)
      else toast.success(`Export créé : ${pluriel(r.lignes, 'ligne')}, ${pluriel(r.fichiers, 'fichier')}.`)
      setExportPret(true)
      router.refresh()
    } finally {
      setExportEnCours(false)
    }
  }

  const ouvrir = () => {
    setOuverte(true); setZipConfirme(false); setSimulation(null); setErreur(null); setSaisie('')
  }

  // « Oui, il est enregistré » : la procédure continue, simulation comprise.
  const continuer = async () => {
    setZipConfirme(true)
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
      else toast.success(`Données de « ${nom} » effacées : ${pluriel(r.lignes, 'ligne')}, ${pluriel(r.comptes, 'compte')}, ${pluriel(r.fichiers, 'fichier')}.`)
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
        {actif || !exportPret ? (
          <Tooltip content={actif ? "Coupez d'abord l'accès de l'école." : "Exportez d'abord les données de l'école."}>
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
          footer={!zipConfirme ? (
            <>
              <FloatButton type="button" variant="secondary" onClick={() => {
                setOuverte(false)
                toast.warning("Enregistrez d'abord le fichier ZIP : cliquez à nouveau sur « Exporter ».")
              }}>
                Non
              </FloatButton>
              <FloatButton type="button" variant="danger" onClick={continuer}>Oui, il est enregistré</FloatButton>
            </>
          ) : (
            <>
              <FloatButton type="button" variant="secondary" onClick={() => setOuverte(false)}>Annuler</FloatButton>
              <FloatButton
                type="button"
                variant="danger"
                loading={effacement}
                disabled={!simulation || !saisieConforme(saisie, slug) || effacement}
                onClick={effacer}
              >
                Effacer définitivement
              </FloatButton>
            </>
          )}
        >
          {!zipConfirme ? (
            <p className="text-sm text-secondary-800">
              Avez-vous enregistré le fichier ZIP de l&apos;export sur votre ordinateur ? Il est effacé avec les
              données de l&apos;école.
            </p>
          ) : (
          <div className="space-y-3 text-sm">
            {erreur && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{erreur}</p>}
            {!simulation && !erreur && <p className="text-warm-700">Simulation en cours…</p>}
            {simulation && (
              <>
                <p className="text-secondary-800">
                  <span className="font-semibold">{nom}</span> : {total} lignes dans {tables.length} tables,{' '}
                  {pluriel(simulation.comptes, 'compte')} de connexion, {pluriel(simulation.fichiers, 'fichier')}.
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
                  L&apos;effacement est définitif. La fiche reste et pourra être rouverte, mais vide.
                </p>
                <SaisieConfirmation
                  label={`Saisissez « ${slug} » pour confirmer`}
                  valeur={saisie}
                  onChange={setSaisie}
                />
              </>
            )}
          </div>
          )}
        </FormModal>
      )}
    </div>
  )
}
