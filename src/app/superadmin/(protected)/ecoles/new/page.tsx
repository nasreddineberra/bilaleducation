'use client'

import { useState } from 'react'
import { FloatButton, FloatInput } from '@/components/ui/FloatFields'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'
import { createTenant } from '@/app/superadmin/actions'
import { validateSlug, SLUG_MAX } from '@/lib/tenant/slug'
import { isPasswordValid } from '@/lib/validation/password'
import PasswordChecklist from '@/components/ui/PasswordChecklist'
import TempPasswordField from '@/components/superadmin/TempPasswordField'

type FormData = {
  slug: string; nom: string; adresse: string; telephone: string
  subscription_expires_at: string; max_students: string
  first_name: string; last_name: string; email: string; password: string
}

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
// Regle unique, partagee avec la server action : `src/lib/tenant/slug.ts`.

// Titre d'encadre, celui de la fiche etablissement (EcoleInfoForm).
const TITRE = 'text-xs font-bold text-warm-700 uppercase tracking-widest'

export default function NewEcolePage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>({
    slug: '', nom: '', adresse: '', telephone: '',
    subscription_expires_at: '', max_students: '',
    first_name: '', last_name: '', email: '', password: '',
  })
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [cree,         setCree]         = useState<{ id: string; emailEnvoye: boolean } | null>(null)

  const set   = (field: keyof FormData, value: string) => setForm(p => ({ ...p, [field]: value }))
  const touch = (field: string) => setTouched(p => new Set([...p, field]))

  const v = {
    slug:       validateSlug(form.slug) !== null,
    nom:        form.nom.trim().length < 2,
    first_name: form.first_name.trim().length < 2,
    last_name:  form.last_name.trim().length  < 2,
    email:      !isValidEmail(form.email.trim()),
    max_students: form.max_students.trim().length > 0 &&
                  (!/^\d+$/.test(form.max_students.trim()) || parseInt(form.max_students, 10) < 1),
    password:   !isPasswordValid(form.password, form.first_name, form.last_name),
  }
  const isValid = !Object.values(v).some(Boolean)

  /** Message d'erreur d'un champ, une fois le champ quitte. */
  const err = (field: keyof typeof v, message: string) =>
    v[field] && touched.has(field) ? message : undefined

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
        subscription_expires_at: form.subscription_expires_at || null,
        max_students: form.max_students.trim() ? parseInt(form.max_students, 10) : null,
        director: {
          first_name: form.first_name.trim(),
          last_name:  form.last_name.trim(),
          email:      form.email.trim(),
          password:   form.password,
        },
      })
      if (result.error) { setError(result.error); return }
      // On ne repart PAS vers la liste : le mot de passe temporaire vient d'être
      // généré, et il n'existe plus nulle part une fois cet écran quitté. C'est
      // le motif de l'écran de création d'un enseignant, pour la même raison.
      setCree({ id: result.id!, emailEnvoye: Boolean(result.emailEnvoye) })
      router.refresh()
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (cree) {
    return (
      <div className="space-y-4 animate-fade-in max-w-xl">
        <div className="card p-3 space-y-3">
          <h2 className={TITRE}>Établissement créé</h2>
          <p className="text-sm text-secondary-700">
            <span className="font-semibold">{form.nom}</span> est en ligne sur{' '}
            <span className="font-mono text-xs">{form.slug}.bilaleducation.fr</span>.
          </p>

          {cree.emailEnvoye ? (
            <p role="status" className="text-sm ton-ok rounded-xl px-4 py-3">
              Un lien de définition du mot de passe a été envoyé à{' '}
              <span className="font-semibold">{form.email}</span>.
            </p>
          ) : (
            <p role="alert" className="text-sm ton-attente rounded-xl px-4 py-3">
              L&apos;email n&apos;a pas pu être envoyé. Transmettez le mot de passe
              ci-dessous, ou renvoyez le lien depuis la fiche une fois la messagerie
              configurée.
            </p>
          )}

          {/* Le repli, affiché UNE SEULE FOIS : il n'existe nulle part ailleurs.
              Le lien par email reste le chemin normal — celui-ci sert quand la
              boîte est inaccessible ou l'adresse erronée. */}
          <div>
            <p className="text-xs font-semibold text-warm-700 uppercase tracking-wide">
              Mot de passe temporaire (à conserver maintenant)
            </p>
            <p className="mt-1 font-mono text-sm text-secondary-800 bg-warm-50 border border-warm-200 rounded-lg px-3 py-2 select-all">
              {form.password}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <FloatButton href={`/superadmin/ecoles/${cree.id}`} variant="submit">Ouvrir la fiche</FloatButton>
            <FloatButton href="/superadmin" variant="secondary">Retour à la liste</FloatButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Pas de titre de page (l'onglet le dit) : la grande icône de retour de la
          fiche établissement. */}
      <Tooltip content="Retour à la liste">
        <Link
          href="/superadmin"
          aria-label="Retour à la liste"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--survol-ligne)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
        >
          <ChevronLeft className="w-7 h-7" />
        </Link>
      </Tooltip>

      <form onSubmit={handleSubmit} noValidate className="space-y-3 max-w-5xl">
        <div className="grid grid-cols-2 gap-3 items-start">

        <div className="space-y-3">
        <div className="card p-3 space-y-3">
          <h2 className={TITRE}>Établissement</h2>

          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <FloatInput
                label="Sous-domaine"
                required
                value={form.slug}
                maxLength={SLUG_MAX}
                onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, SLUG_MAX))}
                onBlur={() => touch('slug')}
                error={touched.has('slug') ? (validateSlug(form.slug) ?? undefined) : undefined}
                className="mono"
              />
            </div>
            <span className="mono text-xs text-warm-700 pt-2">.bilaleducation.fr</span>
          </div>

          <FloatInput label="Nom de l'établissement" required value={form.nom}
            onChange={e => set('nom', e.target.value.toUpperCase())} onBlur={() => touch('nom')}
            error={err('nom', 'Obligatoire (2 caractères min.).')} />

          <div className="grid grid-cols-2 gap-3">
            <FloatInput label="Adresse" value={form.adresse} onChange={e => set('adresse', e.target.value)} />
            <FloatInput label="Téléphone" type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} />
          </div>
        </div>

        <div className="card p-3 space-y-3">
          <h2 className={TITRE}>Accès et abonnement</h2>

          {/* « facultatif » dans le libellé : vide, il n'y a ni échéance ni limite. */}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput label="Échéance (facultatif)" type="date" value={form.subscription_expires_at}
              onChange={e => set('subscription_expires_at', e.target.value)} />
            <FloatInput label="Limite d'élèves (facultatif)" type="number" min="1" step="1" value={form.max_students}
              onChange={e => set('max_students', e.target.value)} onBlur={() => touch('max_students')}
              error={err('max_students', 'Nombre entier supérieur à zéro.')} />
          </div>
        </div>

        </div>

        <div className="card p-3 space-y-3">
          <h2 className={TITRE}>Directeur initial</h2>

          <div className="grid grid-cols-2 gap-3">
            <FloatInput label="Nom" required value={form.last_name}
              onChange={e => set('last_name', e.target.value.toUpperCase())} onBlur={() => touch('last_name')}
              error={err('last_name', 'Obligatoire.')} />
            <FloatInput label="Prénom" required value={form.first_name}
              onChange={e => set('first_name', e.target.value)} onBlur={() => touch('first_name')}
              error={err('first_name', 'Obligatoire.')} />
          </div>

          <FloatInput label="Email" required type="email" value={form.email}
            onChange={e => set('email', e.target.value)} onBlur={() => touch('email')}
            error={err('email', 'Adresse email invalide.')} />

          {/* Le mot de passe se GÉNÈRE : l'éditeur ouvre ce compte pour
              quelqu'un d'autre et doit le lui transmettre — il n'a pas à en
              inventer un, ni à le masquer à ses propres yeux. Libellé au-dessus,
              comme dans la fiche (le champ n'est pas un `FloatInput`). */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-warm-700 uppercase tracking-wide">
              Mot de passe temporaire<span className="text-red-700" aria-hidden="true"> *</span>
            </span>
            <TempPasswordField
              value={form.password}
              onChange={v => { set('password', v); touch('password') }}
            />
            {touched.has('password') && form.password.length > 0 && (
              <PasswordChecklist
                password={form.password}
                firstName={form.first_name}
                lastName={form.last_name}
              />
            )}
          </div>
        </div>

        </div>

        {error && <p role="alert" className="text-sm ton-danger rounded-xl px-4 py-3">{error}</p>}

        <div className="flex items-center justify-end gap-3 pt-1">
          <span className="text-xs text-red-700 mr-auto"><span className="font-semibold">*</span> obligatoire</span>
          <FloatButton href="/superadmin" variant="secondary">Annuler</FloatButton>
          <FloatButton type="submit" variant="submit" loading={isSubmitting} disabled={isSubmitting || !isValid}>
            Créer l&apos;établissement
          </FloatButton>
        </div>
      </form>
    </div>
  )
}
