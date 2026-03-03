'use client'

import { useState, useRef } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2 } from 'lucide-react'
import { updateEtablissement, toggleEtablissementActive, updateSubscription, updateMaxStudents } from '@/app/superadmin/actions'
import type { Etablissement } from '@/types/database'

const isValidEmail = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export default function EcoleInfoForm({ ecole }: { ecole: Etablissement }) {
  type FormData = { nom: string; adresse: string; telephone: string; contact: string; notes: string }

  const [form, setForm] = useState<FormData>({
    nom:       ecole.nom       ?? '',
    adresse:   ecole.adresse   ?? '',
    telephone: ecole.telephone ?? '',
    contact:   ecole.contact   ?? '',
    notes:     ecole.notes     ?? '',
  })
  const [subExpiry,    setSubExpiry]    = useState(ecole.subscription_expires_at ? ecole.subscription_expires_at.split('T')[0] : '')
  const [maxStudents,  setMaxStudents]  = useState(ecole.max_students != null ? String(ecole.max_students) : '')
  const initialForm    = useRef<FormData>({ ...form })
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toggling,     setToggling]     = useState(false)
  const [savingDate,   setSavingDate]   = useState(false)
  const [savingMax,    setSavingMax]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  const set   = (f: keyof FormData, v: string) => setForm(p => ({ ...p, [f]: v }))
  const touch = (f: string) => setTouched(p => new Set([...p, f]))

  const vNom     = form.nom.trim().length < 2
  const isValid  = !vNom
  const isUnchanged = (Object.keys(form) as (keyof FormData)[]).every(k => form[k] === initialForm.current[k])

  const inputCls = (field: string, bad: boolean) => bad && touched.has(field) ? 'input input-error' : 'input'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))
    setError(null); setSuccess(false)
    if (!isValid) return
    setIsSubmitting(true)
    try {
      const result = await updateEtablissement(ecole.id, {
        nom:       form.nom.trim(),
        adresse:   form.adresse.trim()   || undefined,
        telephone: form.telephone.trim() || undefined,
        contact:   form.contact.trim()   || undefined,
        notes:     form.notes.trim()     || null,
      })
      if (result.error) { setError(result.error); return }
      initialForm.current = { ...form }
      setSuccess(true)
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    await toggleEtablissementActive(ecole.id, !ecole.is_active)
    setToggling(false)
  }

  const handleSaveDate = async () => {
    setSavingDate(true)
    await updateSubscription(ecole.id, subExpiry || null)
    setSavingDate(false)
  }

  const handleSaveMax = async () => {
    setSavingMax(true)
    const val = maxStudents.trim() ? parseInt(maxStudents, 10) : null
    await updateMaxStudents(ecole.id, val)
    setSavingMax(false)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} noValidate>
        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Informations</h2>

          <Field label="Nom *" error={touched.has('nom') && vNom ? 'Obligatoire.' : undefined}>
            <input type="text" value={form.nom} onChange={e => set('nom', e.target.value.toUpperCase())} onBlur={() => touch('nom')} className={inputCls('nom', vNom)} />
          </Field>

          <Field label="Adresse">
            <input type="text" value={form.adresse} onChange={e => set('adresse', e.target.value)} className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone">
              <input type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} className="input" />
            </Field>
            <Field label="Email contact">
              <input type="email" value={form.contact} onChange={e => set('contact', e.target.value)} onBlur={() => touch('contact')} className="input" />
            </Field>
          </div>

          <Field label="Notes internes">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Observations, historique commercial, contacts clés..."
              rows={3}
              className="input resize-none text-sm"
            />
          </Field>

          {error   && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>}
          {success && <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2"><CheckCircle2 size={15} /> Enregistré.</div>}

          <div className="flex justify-end">
            <button type="submit" disabled={isSubmitting || !isValid || isUnchanged} className={clsx('btn btn-primary', (isSubmitting || !isValid || isUnchanged) && 'opacity-50 cursor-not-allowed')}>
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>

      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Accès & Abonnement</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-secondary-700">Statut d'accès</p>
            <p className="text-xs text-warm-500 mt-0.5">{ecole.is_active ? "L'école peut se connecter." : "L'accès est bloqué."}</p>
          </div>
          <button onClick={handleToggle} disabled={toggling} className={clsx('btn text-sm px-4 py-2', ecole.is_active ? 'btn-danger' : 'btn-primary', toggling && 'opacity-50 cursor-not-allowed')}>
            {toggling ? '...' : ecole.is_active ? 'Désactiver' : 'Activer'}
          </button>
        </div>

        <div className="border-t border-warm-100 pt-3">
          <p className="text-sm font-medium text-secondary-700 mb-2">Expiration abonnement</p>
          <div className="flex items-center gap-2">
            <input type="date" value={subExpiry} onChange={e => setSubExpiry(e.target.value)} className="input flex-1" />
            <button onClick={handleSaveDate} disabled={savingDate} className="btn btn-secondary text-sm px-3 py-2 whitespace-nowrap">
              {savingDate ? '...' : 'Enregistrer'}
            </button>
            {subExpiry && (
              <button onClick={() => { setSubExpiry(''); updateSubscription(ecole.id, null) }} className="btn btn-secondary text-sm px-3 py-2 text-warm-500 whitespace-nowrap">
                Aucune
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-warm-100 pt-3">
          <p className="text-sm font-medium text-secondary-700 mb-0.5">Limite d'élèves (mode essai)</p>
          <p className="text-xs text-warm-400 mb-2">Laisser vide pour un accès illimité</p>
          <div className="flex items-center gap-2">
            <input
              type="number" min="1" placeholder="Illimitée"
              value={maxStudents} onChange={e => setMaxStudents(e.target.value)}
              className="input flex-1"
            />
            <button onClick={handleSaveMax} disabled={savingMax} className="btn btn-secondary text-sm px-3 py-2 whitespace-nowrap">
              {savingMax ? '...' : 'Enregistrer'}
            </button>
            {maxStudents && (
              <button onClick={() => { setMaxStudents(''); updateMaxStudents(ecole.id, null) }} className="btn btn-secondary text-sm px-3 py-2 text-warm-500 whitespace-nowrap">
                Aucune
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
