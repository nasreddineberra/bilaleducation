'use client'

import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown, Plus, Pencil, Trash2, X, FileText, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FloatButton, FloatInput, FloatSelect, FloatTextarea } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: string
  expense_date: string
  label: string
  amount: number
  category: string | null
  document_url: string | null
  notes: string | null
}

interface Revenue {
  id: string
  revenue_date: string
  label: string
  amount: number
  source_type: string | null
  notes: string | null
}

interface Props {
  yearLabel: string
  schoolYearId: string
  cotisations: {
    totalDue: number
    totalPaid: number
    remaining: number
    familyCount: number
    collectRate: number
  }
  teachingCosts: {
    total: number
    byMonth: { month: string; cost: number }[]
  }
  initialExpenses: Expense[]
  totalExpenses: number
  initialRevenues: Revenue[]
  totalRevenues: number
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR')
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-')
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  return `${months[parseInt(mo) - 1]} ${y}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SyntheseClient({
  yearLabel, schoolYearId, cotisations, teachingCosts,
  initialExpenses, totalExpenses: initTotalExp,
  initialRevenues, totalRevenues: initTotalRev,
}: Props) {
  const supabase = createClient()

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [revenues, setRevenues] = useState<Revenue[]>(initialRevenues)
  const [expenseModal, setExpenseModal] = useState<Expense | 'new' | null>(null)
  const [revenueModal, setRevenueModal] = useState<Revenue | 'new' | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'expense' | 'revenue'; id: string } | null>(null)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0)

  const totalExp = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalRev = revenues.reduce((s, r) => s + Number(r.amount), 0)

  // Situation financiere
  const situation = cotisations.totalPaid - teachingCosts.total - totalExp + totalRev

  // ── Refresh data ─────────────────────────────────────────────────────────
  const refreshExpenses = useCallback(async () => {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('school_year_id', schoolYearId)
      .order('expense_date', { ascending: false })
    setExpenses((data ?? []) as Expense[])
  }, [supabase, schoolYearId])

  const refreshRevenues = useCallback(async () => {
    const { data } = await supabase
      .from('other_revenues')
      .select('*')
      .eq('school_year_id', schoolYearId)
      .order('revenue_date', { ascending: false })
    setRevenues((data ?? []) as Revenue[])
  }, [supabase, schoolYearId])

  // ── Delete handlers ──────────────────────────────────────────────────────
  const handleDelete = async (type: 'expense' | 'revenue', id: string) => {
    if (deleteConfirmStep < 1) {
      setDeleteConfirm({ type, id })
      setDeleteConfirmStep(1)
      return
    }
    const table = type === 'expense' ? 'expenses' : 'other_revenues'
    await supabase.from(table).delete().eq('id', id)
    setDeleteConfirm(null)
    setDeleteConfirmStep(0)
    if (type === 'expense') refreshExpenses()
    else refreshRevenues()
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
    setDeleteConfirmStep(0)
  }

  return (
    <div className="space-y-3">

      {/* ── 1. Cotisations ──────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-3 py-2 border-b border-warm-100 bg-warm-50">
          <h3 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Cotisations</h3>
        </div>
        <div className="px-3 py-2">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
              <div>
                <p className="text-[9px] font-semibold text-warm-400 uppercase">Total dû</p>
                <p className="text-sm font-bold text-secondary-800">{fmt(cotisations.totalDue)}</p>
              </div>
              <span className="text-[9px] text-warm-400">{cotisations.familyCount} fam.</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
              <div>
                <p className="text-[9px] font-semibold text-warm-400 uppercase">Reste à percevoir</p>
                <p className="text-sm font-bold text-amber-600">{fmt(cotisations.remaining)}</p>
              </div>
              <TrendingDown className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-warm-100 px-3 py-2">
              <div>
                <p className="text-[9px] font-semibold text-warm-400 uppercase">Taux encaissement</p>
                <p className="text-sm font-bold text-secondary-800">{cotisations.collectRate}%</p>
              </div>
              <div className="h-1.5 w-14 bg-warm-100 rounded-full overflow-hidden">
                <div className="h-full bg-success-500 rounded-full" style={{ width: `${cotisations.collectRate}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-success-200 bg-success-50/30 px-3 py-2">
              <div>
                <p className="text-[9px] font-semibold text-warm-400 uppercase">Total perçu</p>
                <p className="text-sm font-bold text-success-700">{fmt(cotisations.totalPaid)}</p>
              </div>
              <TrendingUp className="w-4 h-4 text-success-500" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row: Enseignement + Depenses + Revenus ─────────────────────── */}
      <div className="grid grid-cols-3 gap-3">

        {/* Cout enseignement */}
        <div className="card overflow-hidden">
          <div className="px-3 py-2 border-b border-warm-100 bg-warm-50">
            <h3 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Coût enseignement</h3>
          </div>
          {teachingCosts.byMonth.length === 0 ? (
            <p className="text-[10px] text-warm-400 italic text-center py-3">Aucune donnée</p>
          ) : (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-warm-50">
                {teachingCosts.byMonth.map(row => (
                  <tr key={row.month} className="hover:bg-warm-50">
                    <td className="px-2 py-1">
                      <a
                        href={`/dashboard/temps-presence?month=${row.month}`}
                        className="text-secondary-600 hover:text-secondary-800 hover:underline"
                      >
                        {fmtMonth(row.month)}
                      </a>
                    </td>
                    <td className="px-2 py-1 text-right font-medium text-warm-700">{fmt(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-warm-200 font-bold bg-warm-50">
                  <td className="px-2 py-1.5 text-warm-600">TOTAL</td>
                  <td className="px-2 py-1.5 text-right text-danger-600">{fmt(teachingCosts.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Depenses */}
        <div className="card overflow-hidden">
          <div className="px-3 py-2 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Dépenses</h3>
            <FloatButton type="button" variant="submit" onClick={() => setExpenseModal('new')} className="!px-2 !py-0.5 !text-xs !font-medium !rounded">
              <Plus size={10} /> Ajouter
            </FloatButton>
          </div>
          {expenses.length === 0 ? (
            <p className="text-[10px] text-warm-400 italic text-center py-3">Aucune dépense</p>
          ) : (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-warm-50">
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-warm-50">
                    <td className="px-1 py-1 text-warm-500 whitespace-nowrap w-0">{fmtDate(e.expense_date)}</td>
                    <td className="px-1.5 py-1 text-left text-warm-700 font-medium truncate" title={e.notes ?? ''}>
                      {e.label}{e.category ? ` (${e.category})` : ''}
                    </td>
                    <td className="px-1 py-1 text-right font-medium text-warm-700 whitespace-nowrap w-0">{fmt(Number(e.amount))}</td>
                    <td className="px-1 py-1 w-0">
                      <span className="flex items-center gap-0.5 justify-end">
                        {e.document_url && (
                          <a href={e.document_url} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded hover:bg-warm-100" title="Voir le document">
                            <FileText size={10} className="text-primary-500" />
                          </a>
                        )}
                        <button onClick={() => setExpenseModal(e)} className="p-0.5 rounded hover:bg-warm-100"><Pencil size={10} className="text-warm-400" /></button>
                        {deleteConfirm?.type === 'expense' && deleteConfirm.id === e.id ? (
                          <>
                            <button onClick={() => handleDelete('expense', e.id)} className="p-0.5 rounded bg-danger-500 text-white"><Trash2 size={10} /></button>
                            <button onClick={cancelDelete} className="p-0.5 rounded hover:bg-warm-100"><X size={10} className="text-warm-400" /></button>
                          </>
                        ) : (
                          <button onClick={() => handleDelete('expense', e.id)} className="p-0.5 rounded hover:bg-warm-100"><Trash2 size={10} className="text-warm-400" /></button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-warm-200 font-bold bg-warm-50">
                  <td colSpan={2} className="px-2 py-1.5 text-warm-600">TOTAL</td>
                  <td className="px-2 py-1.5 text-right text-danger-600">{fmt(totalExp)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Revenus autres */}
        <div className="card overflow-hidden">
          <div className="px-3 py-2 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
            <h3 className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Revenus autres</h3>
            <FloatButton type="button" variant="submit" onClick={() => setRevenueModal('new')} className="!px-2 !py-0.5 !text-xs !font-medium !rounded">
              <Plus size={10} /> Ajouter
            </FloatButton>
          </div>
          {revenues.length === 0 ? (
            <p className="text-[10px] text-warm-400 italic text-center py-3">Aucun revenu</p>
          ) : (
            <table className="w-full text-xs">
              <tbody className="divide-y divide-warm-50">
                {revenues.map(r => (
                  <tr key={r.id} className="hover:bg-warm-50">
                    <td className="px-1 py-1 text-warm-500 whitespace-nowrap w-0">{fmtDate(r.revenue_date)}</td>
                    <td className="px-1.5 py-1 text-left text-warm-700 font-medium truncate" title={r.notes ?? ''}>
                      {r.label}{r.source_type ? ` (${r.source_type})` : ''}
                    </td>
                    <td className="px-1 py-1 text-right font-medium text-warm-700 whitespace-nowrap w-0">{fmt(Number(r.amount))}</td>
                    <td className="px-1 py-1 w-12">
                      <span className="flex items-center gap-0.5 justify-end">
                        <button onClick={() => setRevenueModal(r)} className="p-0.5 rounded hover:bg-warm-100"><Pencil size={10} className="text-warm-400" /></button>
                        {deleteConfirm?.type === 'revenue' && deleteConfirm.id === r.id ? (
                          <>
                            <button onClick={() => handleDelete('revenue', r.id)} className="p-0.5 rounded bg-danger-500 text-white"><Trash2 size={10} /></button>
                            <button onClick={cancelDelete} className="p-0.5 rounded hover:bg-warm-100"><X size={10} className="text-warm-400" /></button>
                          </>
                        ) : (
                          <button onClick={() => handleDelete('revenue', r.id)} className="p-0.5 rounded hover:bg-warm-100"><Trash2 size={10} className="text-warm-400" /></button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-warm-200 font-bold bg-warm-50">
                  <td colSpan={2} className="px-2 py-1.5 text-warm-600">TOTAL</td>
                  <td className="px-2 py-1.5 text-right text-success-600">{fmt(totalRev)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── 5. Situation financiere — solde uniquement ─────────────────── */}
      <div className={clsx(
        'card flex items-center justify-between px-4 py-3 border-l-4',
        situation >= 0 ? 'border-l-success-500 bg-success-50/30' : 'border-l-danger-500 bg-danger-50/30'
      )}>
        <div className="flex items-center gap-2">
          {situation >= 0
            ? <CheckCircle2 className="w-5 h-5 text-success-600" />
            : <AlertCircle className="w-5 h-5 text-danger-600" />
          }
          <span className="text-xs font-bold text-secondary-800 uppercase tracking-widest">Situation financière</span>
        </div>
        <span className={clsx('text-lg font-bold', situation >= 0 ? 'text-success-700' : 'text-danger-700')}>
          {situation >= 0 ? '+ ' : ''}{fmt(situation)}
        </span>
      </div>

      {/* ── Modale Depense ──────────────────────────────────────────────── */}
      {expenseModal && (
        <ExpenseModal
          entry={expenseModal === 'new' ? null : expenseModal}
          schoolYearId={schoolYearId}
          onClose={() => setExpenseModal(null)}
          onSaved={() => { setExpenseModal(null); refreshExpenses() }}
        />
      )}

      {/* ── Modale Revenu ───────────────────────────────────────────────── */}
      {revenueModal && (
        <RevenueModal
          entry={revenueModal === 'new' ? null : revenueModal}
          schoolYearId={schoolYearId}
          onClose={() => setRevenueModal(null)}
          onSaved={() => { setRevenueModal(null); refreshRevenues() }}
        />
      )}
    </div>
  )
}

// ─── Expense Modal ──────────────────────────────────────────────────────────

function ExpenseModal({ entry, schoolYearId, onClose, onSaved }: {
  entry: Expense | null; schoolYearId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = !!entry

  const initDate     = entry?.expense_date ?? new Date().toISOString().slice(0, 10)
  const initLabel    = entry?.label ?? ''
  const initAmount   = entry ? String(entry.amount) : ''
  const initCategory = entry?.category ?? ''
  const initNotes    = entry?.notes ?? ''
  const initDoc      = entry?.document_url ?? ''

  const [date,        setDate]        = useState(initDate)
  const [label,       setLabel]       = useState(initLabel)
  const [amount,      setAmount]      = useState(initAmount)
  const [category,    setCategory]    = useState(initCategory)
  const [notes,       setNotes]       = useState(initNotes)
  const [documentUrl, setDocumentUrl] = useState(initDoc)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const canSubmit = !!date && !!label.trim() && !!amount && parseFloat(amount) > 0
  const hasChanges = !isEdit || (
    date !== initDate || label !== initLabel || amount !== initAmount ||
    category !== initCategory || notes !== initNotes || documentUrl !== initDoc
  )

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `expenses/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('documents-expenses').upload(path, file)
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('documents-expenses').getPublicUrl(path)
    setDocumentUrl(urlData.publicUrl)
    setUploading(false)
  }

  const handleSave = async () => {
    if (!label.trim() || !amount) { setError('Label et montant requis'); return }
    setSaving(true)
    setError(null)

    // Supprimer l'ancien fichier du Storage si le document a été retiré ou remplacé
    const oldUrl = entry?.document_url ?? ''
    if (isEdit && oldUrl && oldUrl !== documentUrl) {
      const match = oldUrl.match(/documents-expenses\/(.+)$/)
      if (match) {
        await supabase.storage.from('documents-expenses').remove([match[1].split('?')[0]])
      }
    }

    const payload: any = {
      expense_date: date,
      label: label.trim(),
      amount: parseFloat(amount),
      category: category.trim() || null,
      notes: notes.trim() || null,
      document_url: documentUrl || null,
    }

    if (!isEdit) {
      payload.school_year_id = schoolYearId
    }

    const { error: err } = isEdit
      ? await supabase.from('expenses').update(payload).eq('id', entry!.id)
      : await supabase.from('expenses').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
          <h3 className="text-base font-bold text-secondary-800">{isEdit ? 'Modifier la dépense' : 'Nouvelle dépense'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <FloatInput label="Montant (EUR)" type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <FloatInput label="Libellé" type="text" placeholder="Description de la dépense" value={label} onChange={e => setLabel(e.target.value)} required />
          <FloatSelect label="Catégorie" value={category} onChange={e => setCategory(e.target.value)}>
            <option value=""></option>
            <option value="Loyer">Loyer — Location des locaux</option>
            <option value="Charges">Charges — Eau, électricité, gaz, internet</option>
            <option value="Fournitures">Fournitures — Matériel pédagogique, papeterie</option>
            <option value="Assurance">Assurance — Assurance locaux, RC</option>
            <option value="Déplacements">Déplacements — Transport, frais de route</option>
            <option value="Communication">Communication — Impression, site web, pub</option>
            <option value="Événements">Événements — Sorties, fêtes, cérémonies</option>
            <option value="Alimentation">Alimentation — Goûters, repas</option>
            <option value="Banque">Banque — Frais bancaires</option>
            <option value="Autre">Autre — Divers</option>
          </FloatSelect>
          <FloatTextarea label="Notes" placeholder="Remarque optionnelle..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          <div>
            <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">Document</label>
            <div className="flex items-center gap-2">
              <label className="btn-secondary text-xs px-3 py-1.5 cursor-pointer flex items-center gap-1">
                <Upload size={12} />
                {uploading ? 'Envoi...' : 'Choisir un fichier'}
                <input type="file" className="sr-only" onChange={handleFileUpload} disabled={uploading} />
              </label>
              {documentUrl && (
                <span className="flex items-center gap-1.5">
                  <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 underline hover:text-primary-800 truncate max-w-[150px]">Voir le document</a>
                  <button type="button" onClick={() => setDocumentUrl('')} className="p-0.5 rounded hover:bg-warm-100" title="Supprimer le document">
                    <X size={12} className="text-danger-500" />
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-warm-100">
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Annuler</FloatButton>
          <FloatButton type="button" variant={isEdit ? 'edit' : 'submit'} onClick={handleSave} disabled={saving || !canSubmit || !hasChanges}>
            {isEdit ? 'Modifier' : 'Valider'}
          </FloatButton>
        </div>
      </div>
    </div>
  )
}

// ─── Revenue Modal ──────────────────────────────────────────────────────────

function RevenueModal({ entry, schoolYearId, onClose, onSaved }: {
  entry: Revenue | null; schoolYearId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const isEdit = !!entry

  const initDate       = entry?.revenue_date ?? new Date().toISOString().slice(0, 10)
  const initLabel      = entry?.label ?? ''
  const initAmount     = entry ? String(entry.amount) : ''
  const initSourceType = entry?.source_type ?? ''
  const initNotes      = entry?.notes ?? ''

  const [date,       setDate]       = useState(initDate)
  const [label,      setLabel]      = useState(initLabel)
  const [amount,     setAmount]     = useState(initAmount)
  const [sourceType, setSourceType] = useState(initSourceType)
  const [notes,      setNotes]      = useState(initNotes)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const canSubmit = !!date && !!label.trim() && !!amount && parseFloat(amount) > 0
  const hasChanges = !isEdit || (
    date !== initDate || label !== initLabel || amount !== initAmount ||
    sourceType !== initSourceType || notes !== initNotes
  )

  const handleSave = async () => {
    if (!label.trim() || !amount) { setError('Label et montant requis'); return }
    setSaving(true)
    setError(null)

    const payload: any = {
      revenue_date: date,
      label: label.trim(),
      amount: parseFloat(amount),
      source_type: sourceType.trim() || null,
      notes: notes.trim() || null,
    }

    if (!isEdit) {
      payload.school_year_id = schoolYearId
    }

    const { error: err } = isEdit
      ? await supabase.from('other_revenues').update(payload).eq('id', entry!.id)
      : await supabase.from('other_revenues').insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
          <h3 className="text-base font-bold text-secondary-800">{isEdit ? 'Modifier le revenu' : 'Nouveau revenu'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-400 transition-colors"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            <FloatInput label="Montant (EUR)" type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <FloatInput label="Libellé" type="text" placeholder="Description du revenu" value={label} onChange={e => setLabel(e.target.value)} required />
          <FloatSelect label="Source" value={sourceType} onChange={e => setSourceType(e.target.value)}>
            <option value=""></option>
            <option value="Don">Don — Dons de particuliers ou entreprises</option>
            <option value="Subvention">Subvention — Aide publique ou associative</option>
            <option value="Événement">Événement — Recettes kermesse, fête, vente</option>
            <option value="Cotisation exceptionnelle">Cotisation exceptionnelle — Contribution ponctuelle</option>
            <option value="Remboursement">Remboursement — Remboursement fournisseur / assurance</option>
            <option value="Partenariat">Partenariat — Sponsoring, mécénat</option>
            <option value="Autre">Autre — Divers</option>
          </FloatSelect>
          <FloatTextarea label="Notes" placeholder="Remarque optionnelle..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-warm-100">
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton type="button" variant="secondary" onClick={onClose} disabled={saving}>Annuler</FloatButton>
          <FloatButton type="button" variant={isEdit ? 'edit' : 'submit'} onClick={handleSave} disabled={saving || !canSubmit || !hasChanges}>
            {isEdit ? 'Modifier' : 'Valider'}
          </FloatButton>
        </div>
      </div>
    </div>
  )
}
