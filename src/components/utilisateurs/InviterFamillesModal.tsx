'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { X, RotateCcw } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { FloatButton, SearchField } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import { chargerFoyersInvitation, inviterTuteurs, type FoyerInvitation, type TuteurInvitation } from '@/app/dashboard/utilisateurs/famille-actions'
import { pluriel } from '@/lib/texte/pluriel'
import type { NumeroTuteur } from '@/lib/parents/participant'

/**
 * « Inviter les familles » (decision 15) : meme fenetre que « Cours adultes en
 * lot » (`ParentsAdultSyncModal`). Une ligne par foyer, un interrupteur par
 * tuteur. Acces deja configure = coche et verrouille ; sans email ou desactive =
 * verrouille. Envoi par paquets, progression, compte rendu.
 */
const PAQUET = 5
const JOUR = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })

function Toggle({ active, disabled, onChange, label }: {
  active: boolean; disabled?: boolean; onChange: () => void; label: string
}) {
  return (
    <button
      type="button" role="switch" aria-checked={active} aria-label={label}
      disabled={disabled} onClick={onChange}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-surface)]',
        active ? 'bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)]' : 'bg-warm-300 dark:bg-[var(--line-strong)]',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', active ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

/** Raison du verrou d'un tuteur, ou `null` s'il peut etre invite. */
function verrou(t: TuteurInvitation): string | null {
  if (t.configure) return 'Accès en ligne configuré'
  if (t.desactive) return 'Accès désactivé : réactivez-le dans la liste'
  if (!t.email) return 'Aucun email'
  return null
}

export default function InviterFamillesModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const toast  = useToast()

  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [rows,     setRows]     = useState<FoyerInvitation[]>([])
  const [choisis,  setChoisis]  = useState<Record<string, boolean>>({}) // cle `${id}-1|2`
  const [search,   setSearch]   = useState('')
  const [envoi,    setEnvoi]    = useState<{ fait: number; total: number } | null>(null)
  const [echecs,   setEchecs]   = useState<string[] | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(null); setEchecs(null)
    chargerFoyersInvitation().then(res => {
      if (res.error) { setError(res.error); setLoading(false); return }
      setRows(res.foyers ?? [])
      setChoisis({})
      setLoading(false)
    })
  }, [])
  useEffect(() => { load() }, [load])

  // Regle projet : fermeture par X / Annuler uniquement (ni Echap, ni clic hors fenetre).

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const filtered = useMemo(() => {
    const q = norm(search.trim())
    if (!q) return rows
    return rows.filter(r => norm(r.tuteur1.nom).includes(q) || (r.tuteur2 ? norm(r.tuteur2.nom).includes(q) : false))
  }, [rows, search])

  const tuteurs = rows.flatMap(f => [
    { cle: `${f.id}-1`, parentId: f.id, n: 1 as NumeroTuteur, t: f.tuteur1 },
    ...(f.tuteur2 ? [{ cle: `${f.id}-2`, parentId: f.id, n: 2 as NumeroTuteur, t: f.tuteur2 }] : []),
  ])
  const aEnvoyer = tuteurs.filter(x => choisis[x.cle] && !verrou(x.t))
  const configures = tuteurs.filter(x => x.t.configure).length

  const setAll = (val: boolean) => setChoisis(() => {
    const next: Record<string, boolean> = {}
    if (val) for (const x of tuteurs) if (!verrou(x.t)) next[x.cle] = true
    return next
  })

  const envoyer = async () => {
    if (aEnvoyer.length === 0) return
    const ratees: string[] = []
    setEnvoi({ fait: 0, total: aEnvoyer.length })
    for (let i = 0; i < aEnvoyer.length; i += PAQUET) {
      const paquet = aEnvoyer.slice(i, i + PAQUET)
      const res = await inviterTuteurs(paquet.map(x => ({ parentId: x.parentId, tutorNumber: x.n })))
      if (res.error) {
        ratees.push(...paquet.map(x => `${x.t.nom} : ${res.error}`))
      } else {
        for (const r of res.resultats ?? []) {
          if (r.error) {
            const x = paquet.find(p => p.parentId === r.parentId && p.n === r.tutorNumber)
            ratees.push(`${x?.t.nom ?? 'Tuteur'} : ${r.error}`)
          }
        }
      }
      setEnvoi({ fait: Math.min(i + PAQUET, aEnvoyer.length), total: aEnvoyer.length })
    }
    const reussies = aEnvoyer.length - ratees.length
    setEnvoi(null)
    router.refresh()
    if (ratees.length === 0) {
      toast.success(`${pluriel(reussies, 'invitation envoyée', 'invitations envoyées')}.`)
      onClose()
      return
    }
    if (reussies > 0) toast.success(`${pluriel(reussies, 'invitation envoyée', 'invitations envoyées')}.`)
    setEchecs(ratees)
    setChoisis({})
    chargerFoyersInvitation().then(res => { if (res.foyers) setRows(res.foyers) })
  }

  const TutorCell = ({ t, k }: { t: TuteurInvitation; k: string }) => {
    const raison = verrou(t)
    const actif = t.configure || !!choisis[k]
    const tgl = (
      <Toggle active={actif} disabled={!!raison || !!envoi}
        onChange={() => setChoisis(c => ({ ...c, [k]: !c[k] }))} label={`Inviter · ${t.nom}`} />
    )
    const etat = t.configure ? 'Accès en ligne'
      : t.desactive ? 'Désactivé'
      : !t.email ? 'Sans email'
      : t.inviteLe ? `Invité le ${JOUR.format(new Date(t.inviteLe))}`
      : 'Jamais invité'
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-secondary-800">{t.nom}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={clsx('text-[11px] font-medium text-right whitespace-nowrap',
            t.configure ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-warm-700')}>
            {etat}
          </span>
          {raison ? <Tooltip content={<span className="whitespace-nowrap">{raison}</span>} maxWidth="max-w-none">{tgl}</Tooltip> : tgl}
        </div>
      </div>
    )
  }

  // PORTAIL : le parent porte `animate-fade-in` ; son transform ferait du
  // conteneur le bloc de reference du `position: fixed`.
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30">
      <div role="dialog" aria-modal="true" aria-labelledby="invit-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 animate-fade-in max-h-[88vh] flex flex-col">
        {/* En-tete */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-warm-100">
          <h3 id="invit-title" className="text-sm font-bold text-secondary-800">Inviter les familles</h3>
          <button onClick={() => !envoi && onClose()} aria-label="Fermer"
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-700 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-surface)]">
            <X size={16} />
          </button>
        </div>

        {/* Barre */}
        {!loading && !error && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-warm-100">
            <SearchField value={search} onChange={setSearch} placeholder="Rechercher…" ariaLabel="Rechercher un tuteur" className="w-44" />
            <div className="flex-1 flex items-center justify-center gap-2">
              <Tooltip content="Sauf les tuteurs verrouillés">
                <FloatButton type="button" variant="secondary" size="mini" disabled={!!envoi} onClick={() => setAll(true)}>
                  Tout sélectionner
                </FloatButton>
              </Tooltip>
              <Tooltip content="Sauf les tuteurs verrouillés">
                <FloatButton type="button" variant="secondary" size="mini" disabled={!!envoi} onClick={() => setAll(false)}>
                  Tout désélectionner
                </FloatButton>
              </Tooltip>
              <Tooltip content="Recharger depuis la base">
                <button type="button" onClick={load} disabled={!!envoi} aria-label="Recharger depuis la base"
                  className="p-1.5 rounded-lg text-warm-700 hover:text-secondary-700 hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-surface)]">
                  <RotateCcw size={18} />
                </button>
              </Tooltip>
            </div>
            <span className="text-xs text-warm-700 whitespace-nowrap">
              <strong className="text-[var(--brand-surface)] dark:text-[var(--brand-accent)]">{configures}</strong> en ligne / {tuteurs.length}
            </span>
          </div>
        )}

        {/* Compte rendu des echecs */}
        {echecs && echecs.length > 0 && (
          <div role="alert" className="mx-5 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
            <p className="font-semibold">{pluriel(echecs.length, 'invitation non envoyée', 'invitations non envoyées')} :</p>
            <ul className="list-disc pl-4 space-y-0.5">{echecs.map((m, i) => <li key={i}>{m}</li>)}</ul>
          </div>
        )}

        {/* Corps */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-warm-700 px-5 py-8">Chargement…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-600 px-5 py-8">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-warm-700 px-5 py-8 text-center">Aucun foyer.</p>
          ) : (
            <table className="w-full text-xs table-fixed">
              <thead className="sticky top-0 bg-warm-50 z-10">
                <tr className="border-b border-warm-100">
                  <th className="list-th w-1/2">Tuteur 1</th>
                  <th className="list-th w-1/2">Tuteur 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {filtered.map(f => (
                  <tr key={f.id} className="transition-colors hover:bg-warm-100 align-middle">
                    <td className="list-td"><TutorCell t={f.tuteur1} k={`${f.id}-1`} /></td>
                    <td className="list-td">
                      {f.tuteur2 ? <TutorCell t={f.tuteur2} k={`${f.id}-2`} /> : <span className="text-warm-700">·</span>}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-warm-700">Aucun résultat.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pied */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-warm-100">
          {envoi && (
            <span className="text-[11px] text-warm-700 tabular-nums" role="status">
              Envoi en cours : {envoi.fait} / {envoi.total}
            </span>
          )}
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={onClose} disabled={!!envoi}>Annuler</FloatButton>
          <FloatButton type="button" variant="submit" onClick={envoyer} disabled={!!envoi || aEnvoyer.length === 0} loading={!!envoi}>
            {`Envoyer les invitations${aEnvoyer.length > 0 ? ` (${aEnvoyer.length})` : ''}`}
          </FloatButton>
        </div>
      </div>
    </div>,
    document.body,
  )
}
