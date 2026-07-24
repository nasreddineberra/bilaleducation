'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { X, RotateCcw, ToggleRight, ToggleLeft } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { FloatButton, SearchField } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import { getParentsForAdultModal, saveParentsAdultCourses, type ParentAdultRow } from '@/app/dashboard/parents/actions'

function Toggle({ active, disabled, onChange, label }: {
  active: boolean; disabled?: boolean; onChange: () => void; label: string
}) {
  return (
    <button
      type="button" role="switch" aria-checked={active} aria-label={label}
      disabled={disabled} onClick={onChange}
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

export default function ParentsAdultSyncModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const toast  = useToast()

  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [rows,    setRows]    = useState<ParentAdultRow[]>([])
  const [working, setWorking] = useState<Record<string, boolean>>({}) // clé `${id}-1|2`
  const [search,  setSearch]  = useState('')
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError(null)
    getParentsForAdultModal().then(res => {
      if (res.error) { setError(res.error); setLoading(false); return }
      const fams = res.families ?? []
      setRows(fams)
      const w: Record<string, boolean> = {}
      for (const f of fams) {
        w[`${f.id}-1`] = f.tutor1Adult
        if (f.tutor2Name) w[`${f.id}-2`] = f.tutor2Adult
      }
      setWorking(w)
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
    if (!q) return rows
    return rows.filter(r => norm(r.tutor1Name).includes(q) || (r.tutor2Name ? norm(r.tutor2Name).includes(q) : false))
  }, [rows, search])

  const isChanged = (f: ParentAdultRow) =>
    working[`${f.id}-1`] !== f.tutor1Adult || (!!f.tutor2Name && working[`${f.id}-2`] !== f.tutor2Adult)
  const changed = rows.filter(isChanged)

  const enrolledCount = rows.reduce((n, f) => n + (working[`${f.id}-1`] ? 1 : 0) + (f.tutor2Name && working[`${f.id}-2`] ? 1 : 0), 0)
  const tutorTotal    = rows.reduce((n, f) => n + 1 + (f.tutor2Name ? 1 : 0), 0)

  const toggle = (key: string) => setWorking(w => ({ ...w, [key]: !w[key] }))

  // Tout cocher / décocher — les tuteurs inscrits (verrouillés) ne sont PAS touchés.
  const setAll = (val: boolean) => setWorking(w => {
    const next = { ...w }
    for (const f of rows) {
      if (!f.tutor1Locked) next[`${f.id}-1`] = val
      if (f.tutor2Name && !f.tutor2Locked) next[`${f.id}-2`] = val
    }
    return next
  })

  const handleSave = async () => {
    if (changed.length === 0) return
    setSaving(true)
    const res = await saveParentsAdultCourses(changed.map(f => ({
      id: f.id,
      tutor1_adult_courses: !!working[`${f.id}-1`],
      tutor2_adult_courses: f.tutor2Name ? !!working[`${f.id}-2`] : f.tutor2Adult,
    })))
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(`Cours adultes mis à jour : ${res.updated ?? 0} famille(s).`)
    router.refresh()
    onClose()
  }

  const TutorCell = ({ name, k, locked, classInfo }: { name: string; k: string; locked: boolean; classInfo: string | null }) => {
    const active = working[k]
    const tgl = (
      <Toggle active={active} disabled={locked} onChange={() => toggle(k)} label={`Cours adultes · ${name}`} />
    )
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-secondary-800">{name}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={clsx('text-[11px] font-medium w-16 text-right whitespace-nowrap', active ? 'text-primary-600' : 'text-warm-400')}>
            {active ? 'Inscrit' : 'Non inscrit'}
          </span>
          {locked
            ? <Tooltip content={<span className="whitespace-nowrap">{classInfo ?? 'Inscrit à un cours adulte — désinscrivez-le d’abord.'}</span>} maxWidth="max-w-none">{tgl}</Tooltip>
            : tgl}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30">
      <div role="dialog" aria-modal="true" aria-labelledby="adult-title"
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 animate-fade-in max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-warm-100">
          <h3 id="adult-title" className="text-sm font-bold text-secondary-800">Inscriptions aux cours adultes</h3>
          <button onClick={() => !saving && onClose()} aria-label="Fermer"
            className="p-1 rounded-lg hover:bg-warm-100 text-warm-700 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
            <X size={16} />
          </button>
        </div>

        {/* Barre */}
        {!loading && !error && (
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-warm-100">
            <SearchField value={search} onChange={setSearch} placeholder="Rechercher…" ariaLabel="Rechercher un tuteur" className="w-44" />
            <div className="flex-1 flex items-center justify-center gap-2">
              <Tooltip content="Tout inscrire (sauf verrouillés)">
                <button type="button" onClick={() => setAll(true)} aria-label="Tout inscrire aux cours adultes"
                  className="p-1 rounded-lg text-warm-700 hover:text-primary-600 hover:bg-primary-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50">
                  <ToggleRight size={26} />
                </button>
              </Tooltip>
              <Tooltip content="Tout désinscrire (sauf verrouillés)">
                <button type="button" onClick={() => setAll(false)} aria-label="Tout désinscrire des cours adultes"
                  className="p-1 rounded-lg text-warm-700 hover:text-amber-600 hover:bg-amber-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/50">
                  <ToggleLeft size={26} />
                </button>
              </Tooltip>
              <Tooltip content="Recharger depuis la base">
                <button type="button" onClick={load} aria-label="Recharger depuis la base"
                  className="p-1.5 rounded-lg text-warm-700 hover:text-secondary-700 hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50">
                  <RotateCcw size={18} />
                </button>
              </Tooltip>
            </div>
            <span className="text-xs text-warm-700 whitespace-nowrap">
              <strong className="text-primary-600">{enrolledCount}</strong> inscrit{enrolledCount > 1 ? 's' : ''} / {tutorTotal}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-warm-700 px-5 py-8">Chargement…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-red-600 px-5 py-8">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-warm-700 px-5 py-8 text-center">Aucun parent.</p>
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
                  <tr key={f.id} className="align-middle">
                    <td className="list-td"><TutorCell name={f.tutor1Name} k={`${f.id}-1`} locked={f.tutor1Locked} classInfo={f.tutor1ClassInfo} /></td>
                    <td className="list-td">
                      {f.tutor2Name
                        ? <TutorCell name={f.tutor2Name} k={`${f.id}-2`} locked={f.tutor2Locked} classInfo={f.tutor2ClassInfo} />
                        : <span className="text-warm-400">·</span>}
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

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-3 border-t border-warm-100">
          <span className="text-[11px] text-warm-700">
            Un tuteur inscrit à un cours adulte reste coché (interrupteur verrouillé).
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
