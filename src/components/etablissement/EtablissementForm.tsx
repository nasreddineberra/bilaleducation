'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { Etablissement } from '@/types/database'

interface EtablissementFormProps {
  etablissement: Etablissement
}

type FormData = {
  nom:       string
  adresse:   string
  telephone: string
  contact:   string
}

const toUpperCase  = (v: string) => v.toUpperCase()
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

export default function EtablissementForm({ etablissement }: EtablissementFormProps) {
  const router = useRouter()

  const [form, setForm] = useState<FormData>({
    nom:       etablissement.nom       ?? '',
    adresse:   etablissement.adresse   ?? '',
    telephone: etablissement.telephone ?? '',
    contact:   etablissement.contact   ?? '',
  })

  const initialForm    = useRef<FormData>({ ...form })
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  // Validation
  const vNom     = form.nom.trim().length < 2
  const vContact = form.contact.trim().length > 0 && !isValidEmail(form.contact.trim())
  const isValid  = !vNom && !vContact

  // Bouton désactivé si aucun changement par rapport à la dernière sauvegarde
  const isUnchanged = (Object.keys(form) as (keyof FormData)[]).every(
    k => form[k] === initialForm.current[k]
  )

  const inputCls = (field: string, bad: boolean) =>
    bad && touched.has(field) ? 'input input-error' : 'input'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))
    setError(null)
    setSuccess(false)

    if (!isValid) return

    setIsSubmitting(true)
    try {
      const payload = {
        nom:       form.nom.trim(),
        adresse:   form.adresse.trim()   || null,
        telephone: form.telephone.trim() || null,
        contact:   form.contact.trim()   || null,
      }

      const supabase = createClient()

      // Update par id : l'établissement existe toujours (créé au setup du tenant)
      const { error } = await supabase
        .from('etablissements')
        .update(payload)
        .eq('id', etablissement.id)
      if (error) throw error

      initialForm.current = { ...form }
      setSuccess(true)
      router.refresh()
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">

      <form onSubmit={handleSubmit} noValidate className="space-y-3 max-w-2xl">

        <div className="card p-4 space-y-3">

          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Informations générales
          </h2>

          {/* Nom */}
          <Field
            label={<>Nom de l'établissement <span className="text-red-400">*</span></>}
            error={touched.has('nom') && vNom ? 'Le nom est obligatoire (2 caractères minimum).' : undefined}
          >
            <input
              type="text"
              value={form.nom}
              onChange={e => set('nom', toUpperCase(e.target.value))}
              onBlur={() => touch('nom')}
              className={inputCls('nom', vNom)}
            />
          </Field>

          {/* Adresse */}
          <Field label="Adresse">
            <input
              type="text"
              value={form.adresse}
              onChange={e => set('adresse', e.target.value)}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {/* Téléphone */}
            <Field label="Téléphone">
              <input
                type="tel"
                value={form.telephone}
                onChange={e => set('telephone', e.target.value)}
                className="input"
              />
            </Field>

            {/* Contact */}
            <Field
              label="Email de contact"
              error={touched.has('contact') && vContact ? 'Adresse email invalide.' : undefined}
            >
              <input
                type="email"
                value={form.contact}
                onChange={e => set('contact', e.target.value)}
                onBlur={() => touch('contact')}
                className={inputCls('contact', vContact)}
              />
            </Field>
          </div>

        </div>

        {/* Messages */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            Informations enregistrées avec succès.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSubmitting || !isValid || isUnchanged}
            className={clsx(
              'btn btn-primary',
              (isSubmitting || !isValid || isUnchanged) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

      </form>

    </div>
  )
}

// ─── Sous-composant ───────────────────────────────────────────────────────────

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
