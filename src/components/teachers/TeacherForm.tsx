'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createTeacherWithAccount, updateTeacher } from '@/app/dashboard/teachers/actions'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatSelect, FloatCheckbox, FloatButton } from '@/components/ui/FloatFields'
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

const CIVILITE_OPTIONS = ['M.', 'Mme']

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
  const toast     = useToast()
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
  const [tempPassword,   setTempPassword]   = useState<string | null>(null)

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

  const isFormValid = !v.civilite && !v.employeeNumber && !v.lastName && !v.firstName && !v.email && !v.hireDate

  const isUnchanged = isEditing && (Object.keys(form) as (keyof FormData)[]).every(
    k => form[k] === initialForm.current[k]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))

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
        toast.error(`Un enseignant "${duplicate.last_name} ${duplicate.first_name}" existe déjà.`)
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
        const result = await updateTeacher(teacher.id, payload)
        if (result.error) {
          toast.error(result.error)
          setIsSubmitting(false)
          return
        }
        router.push(backHref)
        router.refresh()
      } else {
        // Création avec compte utilisateur automatique
        const result = await createTeacherWithAccount(payload)
        if (result.error) {
          toast.error(result.error)
          setIsSubmitting(false)
          return
        }
        // Afficher le mot de passe temporaire
        setTempPassword(result.tempPassword ?? null)
      }
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
      setIsSubmitting(false)
    }
  }

  // ─── Modal mot de passe temporaire ────────────────────────────────────────

  if (tempPassword) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-bold text-secondary-800">Enseignant et compte utilisateur créés</h2>
          <p className="text-sm text-warm-600">
            Un compte utilisateur a été créé automatiquement pour{' '}
            <span className="font-semibold">{form.first_name} {form.last_name}</span> ({form.email}).
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Mot de passe temporaire</p>
            <p className="text-lg font-mono font-bold text-secondary-800 select-all">{tempPassword}</p>
            <p className="text-xs text-amber-600">
              Notez-le maintenant. Il ne sera plus affiché. L'administrateur pourra envoyer un email de réinitialisation depuis la page Utilisateurs.
            </p>
          </div>
          <FloatButton
            variant="submit"
            className="w-full justify-center"
            onClick={() => { router.push(backHref); router.refresh() }}
          >
            Retour à la liste
          </FloatButton>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-5xl">

      <div className="space-y-2 max-w-2xl">

        {/* ── Identité ── */}
        <div className="card p-3 space-y-4">
          <div className="flex items-center">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
              Identité de l'enseignant
            </h2>
            <div className="flex-1 flex justify-center">
              {!isEditing && (
                <FloatCheckbox
                  variant="compact"
                  label="Modifier N° employé"
                  checked={numberEditable}
                  onChange={checked => {
                    setNumberEditable(checked)
                    if (!checked) set('employee_number', originalNumber.current)
                  }}
                />
              )}
            </div>
            <div className="flex-shrink-0 w-24">
              <FloatCheckbox
                variant="switch"
                label=""
                checked={form.is_active}
                onChange={checked => set('is_active', checked)}
                activeLabel="ACTIF"
                inactiveLabel="INACTIF"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* N° employé */}
            <FloatInput
              label="N° employé"
              value={form.employee_number}
              onChange={v => set('employee_number', v)}
              onBlur={() => touch('employee_number')}
              locked={isEditing || !numberEditable}
              error={touched.has('employee_number') && v.employeeNumber ? 'Champ requis' : undefined}
              className="font-mono"
            />

            {/* Date d'embauche */}
            <FloatInput
              label="Date d'embauche"
              required
              type="date"
              value={form.hire_date}
              onChange={v => set('hire_date', v)}
              onBlur={() => touch('hire_date')}
              error={touched.has('hire_date') && v.hireDate ? 'Champ requis' : undefined}
            />
          </div>

          <div className="grid grid-cols-[5.5rem_1fr_1fr] gap-3">
            {/* Civilité */}
            <FloatSelect
              label="Civilité"
              required
              value={form.civilite}
              onChange={v => { set('civilite', v); touch('civilite') }}
              onBlur={() => touch('civilite')}
              error={touched.has('civilite') && v.civilite ? 'Requis' : undefined}
            >
              <option value=""></option>
              {CIVILITE_OPTIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </FloatSelect>

            {/* Nom */}
            <FloatInput
              label="Nom"
              required
              value={form.last_name}
              onChange={v => set('last_name', toUpperCase(v))}
              onBlur={() => touch('last_name')}
              error={touched.has('last_name') && v.lastName ? 'Minimum 2 caractères' : undefined}
            />

            {/* Prénom */}
            <FloatInput
              label="Prénom"
              required
              value={form.first_name}
              onChange={v => set('first_name', toTitleCase(v))}
              onBlur={() => touch('first_name')}
              error={touched.has('first_name') && v.firstName ? 'Minimum 2 caractères' : undefined}
            />
          </div>
        </div>

        {/* ── Contact & Spécialisation ── */}
        <div className="card p-3 space-y-4">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Contact & Spécialisation
          </h2>

          <FloatInput
            label="Email"
            required
            type="email"
            value={form.email}
            onChange={v => set('email', v)}
            onBlur={() => touch('email')}
            error={touched.has('email') && v.email ? 'Email invalide' : undefined}
          />

          <div className="grid grid-cols-2 gap-3">
            <FloatInput
              label="Téléphone"
              type="tel"
              value={form.phone}
              onChange={v => set('phone', v)}
            />
            <FloatInput
              label="Spécialisation"
              value={form.specialization}
              onChange={v => set('specialization', v)}
            />
          </div>

          {!isEditing && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                Un compte utilisateur (role enseignant) sera créé automatiquement avec un mot de passe temporaire.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1 max-w-2xl">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton
          type="button"
          variant="secondary"
          onClick={() => router.push(backHref)}
        >
          Annuler
        </FloatButton>
        <FloatButton
          type="submit"
          variant={isEditing ? 'edit' : 'submit'}
          loading={isSubmitting}
          disabled={!isFormValid || isUnchanged}
        >
          {isEditing ? 'Modifier' : 'Valider'}
        </FloatButton>
      </div>

    </form>
  )
}
