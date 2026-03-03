'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { createTenant } from '@/app/superadmin/actions'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { PASSWORD_RULES, isPasswordValid } from '@/lib/validation/password'

type FormData = {
  slug: string; nom: string; adresse: string; telephone: string
  first_name: string; last_name: string; email: string; password: string
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const isValidSlug  = (v: string) => /^[a-z0-9-]+$/.test(v)

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function PasswordChecklist({ password, firstName, lastName }: { password: string; firstName?: string; lastName?: string }) {
  const hasName = (firstName && firstName.trim().length >= 3) || (lastName && lastName.trim().length >= 3)
  const rules = PASSWORD_RULES.filter(r => hasName ? true : r.key !== 'noFirst' && r.key !== 'noLast')
  return (
    <ul className="mt-1.5 space-y-0.5">
      {rules.map(rule => {
        const ok = rule.test(password, firstName, lastName)
        return (
          <li key={rule.key} className={clsx('flex items-center gap-1.5 text-xs', ok ? 'text-green-600' : 'text-warm-400')}>
            {ok ? <Check size={11} className="flex-shrink-0" /> : <X size={11} className="flex-shrink-0" />}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}

export default function NewEcolePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>({
    slug: '', nom: '', adresse: '', telephone: '',
    first_name: '', last_name: '', email: '', password: '',
  })
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const set   = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }))
  const touch = (field: string) => setTouched(p => new Set([...p, field]))

  const v = {
    slug:       !isValidSlug(form.slug.trim()) || form.slug.trim().length < 2,
    nom:        form.nom.trim().length < 2,
    first_name: form.first_name.trim().length < 2,
    last_name:  form.last_name.trim().length  < 2,
    email:      !isValidEmail(form.email.trim()),
    password:   !isPasswordValid(form.password, form.first_name, form.last_name),
  }
  const isValid = !Object.values(v).some(Boolean)

  const inputCls = (field: keyof typeof v) =>
    v[field] && touched.has(field) ? 'input input-error' : 'input'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))
    setError(null)
    if (!isValid) return

    setIsSubmitting(true)
    try {
      const result = await createTenant({
        slug:      form.slug.trim().toLowerCase(),
        nom:       form.nom.trim(),
        adresse:   form.adresse.trim()   || undefined,
        telephone: form.telephone.trim() || undefined,
        director: {
          first_name: form.first_name.trim(),
          last_name:  form.last_name.trim(),
          email:      form.email.trim(),
          password:   form.password,
        },
      })
      if (result.error) { setError(result.error); return }
      router.push('/superadmin')
      router.refresh()
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <nav className="text-xs text-warm-400 mb-2">
          <Link href="/superadmin" className="hover:text-warm-600">Établissements</Link>
          <span className="mx-1.5">/</span>
          <span className="text-secondary-700">Nouveau</span>
        </nav>
        <h1 className="text-2xl font-bold text-secondary-800">Nouvel établissement</h1>
        <p className="text-warm-500 text-sm mt-1">Créer un nouveau tenant avec son directeur initial</p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 max-w-2xl">
        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Établissement</h2>

          <Field label="Slug (sous-domaine) *" error={touched.has('slug') && v.slug ? 'Lettres minuscules, chiffres et tirets uniquement (min. 2 car.).' : undefined}>
            <div className="flex items-center input gap-0 p-0 overflow-hidden">
              <input
                type="text"
                value={form.slug}
                onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                onBlur={() => touch('slug')}
                placeholder="al-kindi"
                className={clsx('flex-1 px-3 py-2 outline-none bg-transparent text-sm', touched.has('slug') && v.slug && 'text-red-600')}
              />
              <span className="px-3 text-warm-400 text-xs border-l border-warm-200 bg-warm-50 py-2 whitespace-nowrap">.bilaleducation.fr</span>
            </div>
          </Field>

          <Field label="Nom de l'établissement *" error={touched.has('nom') && v.nom ? 'Obligatoire (2 caractères min.).' : undefined}>
            <input type="text" value={form.nom} onChange={e => set('nom', e.target.value.toUpperCase())} onBlur={() => touch('nom')} className={inputCls('nom')} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Adresse">
              <input type="text" value={form.adresse} onChange={e => set('adresse', e.target.value)} className="input" />
            </Field>
            <Field label="Téléphone">
              <input type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} className="input" />
            </Field>
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Directeur initial</h2>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom *" error={touched.has('last_name') && v.last_name ? 'Obligatoire.' : undefined}>
              <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value.toUpperCase())} onBlur={() => touch('last_name')} className={inputCls('last_name')} />
            </Field>
            <Field label="Prénom *" error={touched.has('first_name') && v.first_name ? 'Obligatoire.' : undefined}>
              <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} onBlur={() => touch('first_name')} className={inputCls('first_name')} />
            </Field>
          </div>

          <Field label="Email *" error={touched.has('email') && v.email ? 'Adresse email invalide.' : undefined}>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} onBlur={() => touch('email')} className={inputCls('email')} />
          </Field>

          <Field label="Mot de passe temporaire *">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                onBlur={() => touch('password')}
                className={clsx(inputCls('password'), 'pr-10')}
                placeholder="10 caractères minimum"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600">
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
          </Field>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <Link href="/superadmin" className="btn btn-secondary">Annuler</Link>
          <button type="submit" disabled={isSubmitting} className={clsx('btn btn-primary', isSubmitting && 'opacity-50 cursor-not-allowed')}>
            {isSubmitting ? 'Création...' : "Créer l'établissement"}
          </button>
        </div>
      </form>
    </div>
  )
}
