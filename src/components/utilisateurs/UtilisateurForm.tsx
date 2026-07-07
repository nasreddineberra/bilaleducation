'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, EyeOff, Check, X } from 'lucide-react'
import { clsx } from 'clsx'
import { createUser, updateProfile, updateEmail, sendPasswordReset } from '@/app/dashboard/utilisateurs/actions'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import type { Profile, UserRole } from '@/types/database'
import { PASSWORD_RULES, isPasswordValid } from '@/lib/validation/password'

interface UtilisateurFormProps {
  profile?: Profile
}

type FormData = {
  email:      string
  password:   string
  civilite:   string
  first_name: string
  last_name:  string
  role:       UserRole
  phone:      string
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'direction',                label: 'Direction'          },
  { value: 'comptable',                label: 'Comptable'          },
  { value: 'responsable_pedagogique',  label: 'Resp. Pédagogique'  },
  { value: 'enseignant',               label: 'Enseignant'         },
  { value: 'secretaire',               label: 'Secrétaire'         },
  { value: 'parent',                   label: 'Parent'             },
]

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const toUpperCase  = (v: string) => v.toUpperCase()
const toTitleCase  = (v: string) =>
  v.split(' ').map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : '').join(' ')

export default function UtilisateurForm({ profile }: UtilisateurFormProps) {
  const router     = useRouter()
  const toast      = useToast()
  const isEditing  = !!profile

  const [form, setForm] = useState<FormData>({
    email:      profile?.email      ?? '',
    password:   '',
    civilite:   profile?.civilite   ?? '',
    first_name: profile?.first_name ?? '',
    last_name:  profile?.last_name  ?? '',
    role:       profile?.role       ?? 'enseignant',
    phone:      profile?.phone      ?? '',
  })

  const initialForm    = useRef<FormData>({ ...form })
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resetStatus,  setResetStatus]  = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  // Validation
  const vCivilite  = !form.civilite
  const vEmail     = !isValidEmail(form.email.trim())
  const vPassword  = !isEditing && !isPasswordValid(form.password, form.first_name, form.last_name)
  const vFirstName = form.first_name.trim().length < 2
  const vLastName  = form.last_name.trim().length  < 2
  const isValid    = !vCivilite && !vEmail && !vPassword && !vFirstName && !vLastName

  // Email modifiable uniquement pour admin et direction
  const emailEditable = !isEditing || profile?.role === 'admin' || profile?.role === 'direction'

  const isUnchanged = isEditing && (Object.keys(form) as (keyof FormData)[])
    .filter(k => {
      if (k === 'password') return false
      if (k === 'email' && !emailEditable) return false
      return true
    })
    .every(k => form[k] === initialForm.current[k])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))

    if (!isValid) return

    setIsSubmitting(true)
    try {
      let result: { error?: string }

      if (isEditing) {
        if (emailEditable && form.email.trim() !== initialForm.current.email) {
          const emailResult = await updateEmail(profile.id, form.email.trim())
          if (emailResult.error) { toast.error(emailResult.error); setIsSubmitting(false); return }
        }
        result = await updateProfile(profile.id, {
          role:       form.role,
          civilite:   form.civilite.trim() || undefined,
          first_name: form.first_name.trim(),
          last_name:  form.last_name.trim(),
          phone:      form.phone.trim() || undefined,
        })
      } else {
        result = await createUser({
          email:      form.email.trim(),
          password:   form.password,
          role:       form.role,
          civilite:   form.civilite.trim() || undefined,
          first_name: form.first_name.trim(),
          last_name:  form.last_name.trim(),
          phone:      form.phone.trim() || undefined,
        })
      }

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success(isEditing ? 'Utilisateur modifié avec succès.' : 'Utilisateur créé avec succès.')
      router.push('/dashboard/utilisateurs')
      router.refresh()
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 max-w-2xl">

      <div className="card p-4 space-y-3">

        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
          {isEditing ? 'Informations du compte' : 'Nouveau compte utilisateur'}
        </h2>

        {/* Civilité / Nom / Prénom */}
        <div className="grid grid-cols-[7rem_1fr_1fr] gap-3">
          <FloatSelect
            label="Civilité"
            required
            aria-required="true"
            value={form.civilite}
            onChange={e => set('civilite', e.target.value)}
            onBlur={() => touch('civilite')}
            error={touched.has('civilite') && vCivilite ? 'Requis' : undefined}
          >
            <option value="" disabled hidden></option>
            <option value="M.">M.</option>
            <option value="Mme">Mme</option>
          </FloatSelect>
          <FloatInput
            label="Nom"
            required
            aria-required="true"
            value={form.last_name}
            onChange={e => set('last_name', toUpperCase(e.target.value))}
            onBlur={() => touch('last_name')}
            error={touched.has('last_name') && vLastName ? 'Obligatoire (2 caractères min.).' : undefined}
          />
          <FloatInput
            label="Prénom"
            required
            aria-required="true"
            value={form.first_name}
            onChange={e => set('first_name', toTitleCase(e.target.value))}
            onBlur={() => touch('first_name')}
            error={touched.has('first_name') && vFirstName ? 'Obligatoire (2 caractères min.).' : undefined}
          />
        </div>

        {/* Rôle / Téléphone */}
        <div className="grid grid-cols-2 gap-3">
          <FloatSelect
            label="Rôle"
            required
            aria-required="true"
            value={form.role}
            onChange={e => set('role', e.target.value as UserRole)}
            disabled={profile?.role === 'admin'}
          >
            {profile?.role === 'admin'
              ? <option value="admin">Administrateur</option>
              : ROLE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))
            }
          </FloatSelect>
          <FloatInput
            label="Téléphone"
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>

        {/* Email */}
        <FloatInput
          label="Email"
          required
          aria-required="true"
          type="email"
          locked={isEditing && !emailEditable}
          value={form.email}
          onChange={e => set('email', e.target.value)}
          onBlur={() => touch('email')}
          error={touched.has('email') && vEmail ? 'Adresse email invalide.' : undefined}
        />

        {/* Réinitialisation mot de passe (édition uniquement) */}
        {isEditing && (
          <div className="flex items-center justify-between gap-4 bg-warm-50 border border-warm-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Mot de passe</p>
              <p className="text-xs text-warm-500 mt-0.5">Envoyer un lien par email pour réinitialiser.</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span role="status" aria-live="polite" className="text-xs">
                {resetStatus === 'sent' && (
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={13} /> Lien envoyé.</span>
                )}
                {resetStatus === 'error' && (
                  <span className="text-red-500">Erreur lors de l'envoi.</span>
                )}
              </span>
              <FloatButton
                type="button"
                variant="secondary"
                disabled={resetStatus === 'sending' || vEmail}
                onClick={async () => {
                  setResetStatus('sending')
                  const r = await sendPasswordReset(form.email.trim())
                  setResetStatus(r.error ? 'error' : 'sent')
                }}
              >
                {resetStatus === 'sending' ? 'Envoi…' : 'Réinitialiser'}
              </FloatButton>
            </div>
          </div>
        )}

        {/* Mot de passe (création uniquement) */}
        {!isEditing && (
          <div>
            <div className="relative">
              <FloatInput
                label="Mot de passe temporaire"
                required
                aria-required="true"
                type={showPassword ? 'text' : 'password'}
                className="pr-10"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                onBlur={() => touch('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {touched.has('password') && form.password.length > 0 && (
              <PasswordChecklist
                password={form.password}
                firstName={form.first_name}
                lastName={form.last_name}
              />
            )}
          </div>
        )}

      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-warm-500"><span className="font-semibold text-red-400">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton
          type="button"
          variant="secondary"
          onClick={() => router.push('/dashboard/utilisateurs')}
        >
          Annuler
        </FloatButton>
        <FloatButton
          type="submit"
          variant={isEditing ? 'edit' : 'submit'}
          disabled={isSubmitting || !isValid || isUnchanged}
        >
          {isSubmitting
            ? 'Enregistrement...'
            : isEditing ? 'Modifier' : 'Valider'}
        </FloatButton>
      </div>

    </form>
  )
}

// ─── Checklist force du mot de passe ──────────────────────────────────────────

function PasswordChecklist({
  password,
  firstName,
  lastName,
}: {
  password:   string
  firstName?: string
  lastName?:  string
}) {
  const hasName = (firstName && firstName.trim().length >= 3) ||
                  (lastName  && lastName.trim().length  >= 3)

  const rules = PASSWORD_RULES.filter(r =>
    hasName ? true : r.key !== 'noFirst' && r.key !== 'noLast'
  )

  return (
    <ul className="mt-1.5 space-y-0.5">
      {rules.map(rule => {
        const ok = rule.test(password, firstName, lastName)
        return (
          <li key={rule.key} className={clsx(
            'flex items-center gap-1.5 text-xs',
            ok ? 'text-green-600' : 'text-warm-400'
          )}>
            {ok
              ? <Check size={11} className="flex-shrink-0" />
              : <X    size={11} className="flex-shrink-0" />
            }
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

