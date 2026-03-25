'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Teacher } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherFormProps {
  teacher?: Teacher
  defaultEmployeeNumber?: string
  backHref?: string
}

type FormData = {
  employee_number: string
  civilite:        string
  last_name:       string
  first_name:      string
  email:           string
  phone:           string
  hire_date:       string
  specialization:  string
  is_active:       boolean
}

const CIVILITE_OPTIONS = ['', 'M.', 'Mme']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toUpperCase = (v: string) => v.toUpperCase()
const toTitleCase = (v: string) =>
  v.split(' ').map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : '').join(' ')
const clean = (v: string): string | null => v.trim() || null
const today = new Date().toISOString().split('T')[0]
const normalizeNom = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

// ─── Composant principal ──────────────────────────────────────────────────────

export default function TeacherForm({ teacher, defaultEmployeeNumber, backHref = '/dashboard/teachers' }: TeacherFormProps) {
  const router    = useRouter()
  const isEditing = !!teacher

  const [form, setForm] = useState<FormData>({
    employee_number: teacher?.employee_number ?? defaultEmployeeNumber ?? '',
    civilite:        teacher?.civilite        ?? '',
    last_name:       teacher?.last_name       ?? '',
    first_name:      teacher?.first_name      ?? '',
    email:           teacher?.email           ?? '',
    phone:           teacher?.phone           ?? '',
    hire_date:       teacher?.hire_date       ?? today,
    specialization:  teacher?.specialization  ?? '',
    is_active:       teacher?.is_active       ?? true,
  })

  const originalNumber = useRef(teacher?.employee_number ?? defaultEmployeeNumber ?? '')
  const initialForm    = useRef<FormData>({ ...form })

  const [numberEditable, setNumberEditable] = useState(false)
  const [touched,        setTouched]        = useState<Set<string>>(new Set())
  const [isSubmitting,   setIsSubmitting]   = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const set   = (field: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  // Validation
  const v = {
    civilite:       !form.civilite,
    employeeNumber: form.employee_number.trim().length < 1,
    lastName:       form.last_name.trim().length      < 2,
    firstName:      form.first_name.trim().length     < 2,
    email:          !isValidEmail(form.email),
    hireDate:       !form.hire_date,
  }
  const invalid = (field: string, bad: boolean) => touched.has(field) && bad
  const cls     = (field: string, bad: boolean) =>
    bad && touched.has(field) ? 'input input-error' : 'input'

  const isFormValid = !v.civilite && !v.employeeNumber && !v.lastName && !v.firstName && !v.email && !v.hireDate

  const isUnchanged = isEditing && (Object.keys(form) as (keyof FormData)[]).every(
    k => form[k] === initialForm.current[k]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))
    setError(null)

    if (!isFormValid) return

    setIsSubmitting(true)
    try {
      // Vérification doublon nom + prénom (insensible casse et accents)
      const supabase = createClient()
      const { data: sameLastName } = await supabase
        .from('teachers')
        .select('id, last_name, first_name')
        .ilike('last_name', form.last_name.trim())
      const normFirst = normalizeNom(form.first_name)
      const duplicate = sameLastName?.find(t =>
        t.id !== teacher?.id &&
        normalizeNom(t.first_name) === normFirst
      )
      if (duplicate) {
        setError(`Un enseignant "${duplicate.last_name} ${duplicate.first_name}" existe déjà.`)
        setIsSubmitting(false)
        return
      }

      const payload = {
        employee_number: form.employee_number.trim(),
        civilite:        clean(form.civilite),
        last_name:       form.last_name.trim(),
        first_name:      form.first_name.trim(),
        email:           form.email.trim().toLowerCase(),
        phone:           clean(form.phone),
        hire_date:       form.hire_date,
        specialization:  clean(form.specialization),
        is_active:       form.is_active,
      }

      if (isEditing) {
        const { error } = await supabase.from('teachers').update(payload).eq('id', teacher.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('teachers').insert(payload)
        if (error) throw error
      }

      router.push(backHref)
      router.refresh()
    } catch (err: any) {
      if (err?.code === '23505') {
        setError("Ce numéro d'employé est déjà utilisé.")
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-5xl">

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">

        {/* ── Colonne gauche : Identité ── */}
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
              Identité
            </h2>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500"
              />
              <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide group-hover:text-warm-600">
                Actif
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* N° employé */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">N° employé</span>
                {!isEditing && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={numberEditable}
                      onChange={e => {
                        setNumberEditable(e.target.checked)
                        if (!e.target.checked) set('employee_number', originalNumber.current)
                      }}
                      className="w-3 h-3 rounded accent-amber-500"
                    />
                    <span className="text-xs text-warm-400 select-none">Modifier</span>
                  </label>
                )}
              </div>
              {!isEditing && numberEditable ? (
                <input
                  type="text"
                  value={form.employee_number}
                  onChange={e => set('employee_number', e.target.value)}
                  onBlur={() => touch('employee_number')}
                  className="input font-mono"
                  autoFocus
                />
              ) : (
                <div className="input bg-warm-100 text-secondary-500 font-mono text-sm select-all cursor-default">
                  {form.employee_number}
                </div>
              )}
            </div>

            <Field label={<>Date d'embauche <span className="text-red-400">*</span></>} error={invalid('hire_date', v.hireDate) ? 'Champ requis' : undefined}>
              <input
                type="date"
                value={form.hire_date}
                onChange={e => set('hire_date', e.target.value)}
                onBlur={() => touch('hire_date')}
                className={cls('hire_date', v.hireDate)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
            <Field label={<>Civilité <span className="text-red-400">*</span></>} error={invalid('civilite', v.civilite) ? 'Requis' : undefined}>
              <select
                value={form.civilite}
                onChange={e => set('civilite', e.target.value)}
                onBlur={() => touch('civilite')}
                className={cls('civilite', v.civilite)}
              >
                {CIVILITE_OPTIONS.map(c => (
                  <option key={c} value={c}>{c || '—'}</option>
                ))}
              </select>
            </Field>
            <Field label={<>Nom <span className="text-red-400">*</span></>} error={invalid('last_name', v.lastName) ? 'Minimum 2 caractères' : undefined}>
              <input
                type="text"
                value={form.last_name}
                onChange={e => set('last_name', toUpperCase(e.target.value))}
                onBlur={() => touch('last_name')}
                className={cls('last_name', v.lastName)}
              />
            </Field>
            <Field label={<>Prénom <span className="text-red-400">*</span></>} error={invalid('first_name', v.firstName) ? 'Minimum 2 caractères' : undefined}>
              <input
                type="text"
                value={form.first_name}
                onChange={e => set('first_name', toTitleCase(e.target.value))}
                onBlur={() => touch('first_name')}
                className={cls('first_name', v.firstName)}
              />
            </Field>
          </div>
        </div>

        {/* ── Colonne droite : Contact & Spécialisation ── */}
        <div className="card p-3 space-y-2">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Contact & Spécialisation
          </h2>

          <Field label={<>Email <span className="text-red-400">*</span></>} error={invalid('email', v.email) ? 'Email invalide' : undefined}>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              onBlur={() => touch('email')}
              className={cls('email', v.email)}
              placeholder="prenom.nom@exemple.com"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Téléphone">
              <input
                type="tel"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className="input"
                placeholder="06 00 00 00 00"
              />
            </Field>
            <Field label="Spécialisation">
              <input
                type="text"
                value={form.specialization}
                onChange={e => set('specialization', e.target.value)}
                className="input"
                placeholder="ex : Mathématiques, Arabe…"
              />
            </Field>
          </div>
        </div>

      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="btn btn-secondary"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting || isUnchanged}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? 'Enregistrement...'
            : isEditing ? 'Mettre à jour' : 'Créer la fiche'}
        </button>
      </div>

    </form>
  )
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
