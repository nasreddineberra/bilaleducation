'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { X, RotateCcw, ToggleRight, ToggleLeft } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { FloatButton, SearchField } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import { getStudentsForStatusModal, saveStudentsActive, type StudentStatusRow } from '@/app/dashboard/students/actions'

// Petit interrupteur actif/inactif
function Toggle({ active, disabled, onChange, label }: {
  active: boolean; disabled?: boolean; onChange: () => void; label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        'relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
        active ? 'bg-primary-500' : 'bg-warm-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', active ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  )
}

export default function StudentsStatusSyncModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const toast  = useToast()

  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [yearLabel, setYearLabel] = useState('')
  const [rows,      setRows]      = useState<StudentStatusRow[]>([])
  const [working,   setWorking]   = useState<Record<string, boolean>>({})
  const [search,    setSearch]    = useState('')
  const [saving,    setSaving]    = useState(false)

  // Charge (ou recharge) les statuts depuis la base ; réinitialise l'état de travail.
  const load = useCallback(() => {
    setLoading(true); setError(null)
    getStudentsForStatusModal().then(res => {
      if (res.error) { setError(res.error); setLoading(false); return }
      setYearLabel(res.yearLabel ?? '')
      setRows(res.students ?? [])
      setWorking(Object.fromEntries((res.students ?? []).map(s => [s.id, s.is_active])))
      setLoading(false)
    })
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [saving, onClose])

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const filtered = useMemo(() => {
    const q = norm(search.trim())
    return q ? rows.filter(r => norm(r.name).includes(q)) : rows
  }, [rows, search])

  const changed = rows.filter(r => working[r.id] !== r.is_active)
  const activeCount = rows.filter(r => working[r.id]).length

  const toggle = (id: string) => setWorking(w => ({ ...w, [id]: !w[id] }))

  // Tout actif / tout inactif — les apprenants affectés à une classe ne sont PAS concernés.
  const setAll = (val: boolean) => setWorking(w => {
    const next = { ...w }
    for (const r of rows) if (!r.enrolled) next[r.id] = val
    return next
  })

  const handleSave = async () => {
    if (changed.length === 0) return
    setSaving(true)
    const res = await saveStudentsActive(changed.map(r => ({ id: r.id, is_active: working[r.id] })))
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(`Statuts mis à jour : ${res.activated ?? 0} activé(s), ${res.deactivated ?? 0} désactivé(s).`)
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30">
      <div
        role="dialog" aria-modal="true" aria-labelledby="status-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 animate-fade-in max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-warm-100">
          <h3 id="status-title" className="text-sm font-bold text-secondary-800">
            Statuts des apprenants{yearLabel ? ` · ${yearLabel}` : ''}
          </h3>
          <button
            onClick={() => !saving && onClose()}
            aria-label="Fermer"
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-400 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Barre : recherche + compteur */}
        {!loading && !error && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-warm-100">
            <SearchField value={search} onChange={setSearch} placeholder="Rechercher…" ariaLabel="Rechercher un apprenant" className="w-44" />
            <div className="flex-1 flex items-center justify-center gap-2">
              <Tooltip content="Tout actif (sauf affectés)">
                <button
                  type="button" onClick={() => setAll(true)} aria-label="Rendre tout actif (sauf apprenants affectés)"
                  className="p-1 rounded-lg text-warm-400 hover:text-primary-600 hover:bg-primary-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                >
                  <ToggleRight size={26} />
                </button>
              </Tooltip>
              <Tooltip content="Tout inactif (sauf affectés)">
                <button
                  type="button" onClick={() => setAll(false)} aria-label="Rendre tout inactif (sauf apprenants affectés)"
                  className="p-1 rounded-lg text-warm-400 hover:text-amber-600 hover:bg-amber-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/50"
                >
                  <ToggleLeft size={26} />
                </button>
              </Tooltip>
              <Tooltip content="Recharger depuis la base">
                <button
                  type="button" onClick={load} aria-label="Recharger les statuts depuis la base"
                  className="p-1.5 rounded-lg text-warm-400 hover:text-secondary-700 hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                >
                  <RotateCcw size={18} />
                </button>
              </Tooltip>
            </div>
            <span className="text-xs text-warm-500 whitespace-nowrap">
              <strong className="text-primary-600">{activeCount}</strong> actif{activeCount > 1 ? 's' : ''} / {rows.length}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-warm-400 px-5 py-8">Chargement…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-600 px-5 py-8">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-warm-400 px-5 py-8 text-center">Aucun apprenant.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-warm-50 z-10">
                <tr className="border-b border-warm-100">
                  <th className="list-th">Apprenant</th>
                  <th className="list-th">Classe</th>
                  <th className="list-th text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {filtered.map(r => {
                  const active = working[r.id]
                  return (
                    <tr key={r.id} className={clsx('transition-colors', !active && 'bg-warm-50/50')}>
                      <td className="list-td"><span className="list-name text-secondary-800">{r.name}</span></td>
                      <td className="list-td">
                        {r.className ? (
                          r.classTooltip ? (
                            <Tooltip content={<span className="whitespace-nowrap">{r.classTooltip}</span>} maxWidth="max-w-none">
                              <span className="text-[11px] font-medium bg-primary-50 text-primary-700 border border-primary-200 px-1.5 py-0.5 rounded-full cursor-default">{r.className}</span>
                            </Tooltip>
                          ) : (
                            <span className="text-[11px] font-medium bg-primary-50 text-primary-700 border border-primary-200 px-1.5 py-0.5 rounded-full">{r.className}</span>
                          )
                        ) : (
                          <span className="text-warm-400 italic">Non affecté</span>
                        )}
                      </td>
                      <td className="list-td">
                        <div className="flex items-center justify-end gap-2">
                          <span className={clsx('text-[11px] font-medium w-12 text-right', active ? 'text-primary-600' : 'text-warm-400')}>
                            {active ? 'Actif' : 'Inactif'}
                          </span>
                          <Toggle
                            active={active}
                            disabled={r.enrolled}
                            onChange={() => toggle(r.id)}
                            label={`Statut de ${r.name}`}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-warm-400">Aucun résultat.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-warm-100">
          <span className="text-[11px] text-warm-400">
            Un apprenant affecté à une classe reste actif (interrupteur verrouillé).
          </span>
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Annuler</FloatButton>
          <FloatButton type="button" variant="submit" onClick={handleSave} disabled={saving || changed.length === 0} loading={saving}>
            {saving ? 'Enregistrement…' : `Enregistrer${changed.length > 0 ? ` (${changed.length})` : ''}`}
          </FloatButton>
        </div>
      </div>
    </div>
  )
}
