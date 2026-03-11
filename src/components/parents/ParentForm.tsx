'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { parentRepository } from '@/lib/database/parents'
import { createClient } from '@/lib/supabase/client'
import type { Parent, TutorRelationship } from '@/types/database'

interface ParentFormProps {
  parent?: Parent
  onClose?: () => void
}

// ─── Indicatifs téléphoniques ─────────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: '+33',  iso: 'fr', name: 'France'         },
  { code: '+32',  iso: 'be', name: 'Belgique'       },
  { code: '+41',  iso: 'ch', name: 'Suisse'         },
  { code: '+213', iso: 'dz', name: 'Algérie'        },
  { code: '+212', iso: 'ma', name: 'Maroc'          },
  { code: '+216', iso: 'tn', name: 'Tunisie'        },
  { code: '+221', iso: 'sn', name: 'Sénégal'        },
  { code: '+223', iso: 'ml', name: 'Mali'           },
  { code: '+225', iso: 'ci', name: "Côte d'Ivoire"  },
  { code: '+20',  iso: 'eg', name: 'Égypte'         },
  { code: '+90',  iso: 'tr', name: 'Turquie'        },
  { code: '+44',  iso: 'gb', name: 'Royaume-Uni'    },
  { code: '+49',  iso: 'de', name: 'Allemagne'      },
  { code: '+34',  iso: 'es', name: 'Espagne'        },
  { code: '+39',  iso: 'it', name: 'Italie'         },
]

const flagUrl = (iso: string) => `https://flagcdn.com/w20/${iso}.png`

const RELATIONSHIP_OPTIONS: { value: TutorRelationship; label: string }[] = [
  { value: 'père',   label: 'Père'        },
  { value: 'mère',   label: 'Mère'        },
  { value: 'tuteur', label: 'Tuteur légal' },
  { value: 'autre',  label: 'Autre'       },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toUpperCase  = (v: string) => v.toUpperCase()
const toTitleCase  = (v: string) =>
  v.split(' ').map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : '').join(' ')
const digitsOnly   = (v: string) => v.replace(/\D/g, '')
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const clean        = (v: string): string | null => v.trim() || null
const normalizeNom = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const parsePhone = (phone?: string | null): { code: string; number: string } => {
  if (!phone) return { code: '+33', number: '' }
  const country = COUNTRY_CODES.find(c => phone.startsWith(c.code))
  return country
    ? { code: country.code, number: phone.slice(country.code.length) }
    : { code: '+33', number: phone }
}

// ─── Situation familiale ──────────────────────────────────────────────────────
const SITUATION_OPTIONS = [
  { value: '',            label: '— Non renseignée'    },
  { value: 'mariés',      label: 'Marié(e)s'           },
  { value: 'pacsés',      label: 'Pacsé(e)s'           },
  { value: 'union_libre', label: 'Union libre'         },
  { value: 'séparés',     label: 'Séparé(e)s'          },
  { value: 'divorcés',    label: 'Divorcé(e)s'         },
  { value: 'veuf_veuve',  label: 'Veuf / Veuve'        },
  { value: 'monoparental',label: 'Famille monoparentale' },
]

const GARDE_OPTIONS = [
  { value: 'alternée',    label: 'Garde alternée'       },
  { value: 'exclusive_t1',label: 'Exclusive tuteur 1'   },
  { value: 'exclusive_t2',label: 'Exclusive tuteur 2'   },
]

const SITUATIONS_WITH_GARDE = new Set(['séparés', 'divorcés'])

// ─── Types ────────────────────────────────────────────────────────────────────
type FormData = {
  tutor1_last_name:    string
  tutor1_first_name:   string
  tutor1_relationship: TutorRelationship
  tutor1_phone_code:   string
  tutor1_phone_number: string
  tutor1_email:        string
  tutor1_address:      string
  tutor1_city:         string
  tutor1_postal_code:  string
  tutor1_profession:   string
  tutor2_last_name:    string
  tutor2_first_name:   string
  tutor2_relationship: TutorRelationship
  tutor2_phone_code:   string
  tutor2_phone_number: string
  tutor2_email:        string
  tutor2_address:       string
  tutor2_city:          string
  tutor2_postal_code:   string
  tutor2_profession:    string
  tutor1_adult_courses: boolean
  tutor2_adult_courses: boolean
  situation_familiale:  string
  type_garde:           string
  notes:                string
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ParentForm({ parent, onClose }: ParentFormProps) {
  const router    = useRouter()
  const isEditing = !!parent

  const t1Phone = parsePhone(parent?.tutor1_phone)
  const t2Phone = parsePhone(parent?.tutor2_phone)

  const [form, setForm] = useState<FormData>({
    tutor1_last_name:    parent?.tutor1_last_name    ?? '',
    tutor1_first_name:   parent?.tutor1_first_name   ?? '',
    tutor1_relationship: parent?.tutor1_relationship ?? 'père',
    tutor1_phone_code:   t1Phone.code,
    tutor1_phone_number: t1Phone.number,
    tutor1_email:        parent?.tutor1_email        ?? '',
    tutor1_address:      parent?.tutor1_address      ?? '',
    tutor1_city:         parent?.tutor1_city         ?? '',
    tutor1_postal_code:  parent?.tutor1_postal_code  ?? '',
    tutor1_profession:   parent?.tutor1_profession   ?? '',
    tutor2_last_name:    parent?.tutor2_last_name    ?? '',
    tutor2_first_name:   parent?.tutor2_first_name   ?? '',
    tutor2_relationship: parent?.tutor2_relationship ?? 'mère',
    tutor2_phone_code:   t2Phone.code,
    tutor2_phone_number: t2Phone.number,
    tutor2_email:        parent?.tutor2_email        ?? '',
    tutor2_address:       parent?.tutor2_address       ?? '',
    tutor2_city:          parent?.tutor2_city          ?? '',
    tutor2_postal_code:   parent?.tutor2_postal_code   ?? '',
    tutor2_profession:    parent?.tutor2_profession    ?? '',
    tutor1_adult_courses: parent?.tutor1_adult_courses ?? false,
    tutor2_adult_courses: parent?.tutor2_adult_courses ?? false,
    situation_familiale:  parent?.situation_familiale  ?? '',
    type_garde:           parent?.type_garde           ?? '',
    notes:                parent?.notes                ?? '',
  })

  const initialForm           = useRef<FormData>({ ...form })
  const initialShowTutor2     = useRef(!!parent?.tutor2_last_name)
  const initialSameAddressT1  = useRef(false)

  const [showTutor2,         setShowTutor2]         = useState(!!parent?.tutor2_last_name)
  const [sameAddressT1,      setSameAddressT1]      = useState(false)
  const [touched,            setTouched]            = useState<Set<string>>(new Set())
  const [isSubmitting,       setIsSubmitting]       = useState(false)
  const [error,              setError]              = useState<string | null>(null)

  const set   = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  // Retourne true si le champ est invalide ET a déjà été touché
  const invalid = (field: string, bad: boolean) => touched.has(field) && bad
  const cls     = (field: string, bad: boolean) =>
    bad && touched.has(field) ? 'input input-error' : 'input'

  // Règles de validation
  const v = {
    t1LastName:  form.tutor1_last_name.trim().length  < 2,
    t1FirstName: form.tutor1_first_name.trim().length < 2,
    t1Email:     !form.tutor1_email || !isValidEmail(form.tutor1_email),
    t2LastName:  form.tutor2_last_name.trim().length  < 2,
    t2FirstName: form.tutor2_first_name.trim().length < 2,
    t2Email:     !form.tutor2_email || !isValidEmail(form.tutor2_email),
  }

  const isFormValid = !v.t1LastName && !v.t1FirstName && !v.t1Email &&
    (!showTutor2 || (!v.t2LastName && !v.t2FirstName && !v.t2Email))

  const isUnchanged = isEditing &&
    (Object.keys(form) as (keyof FormData)[]).every(k => form[k] === initialForm.current[k]) &&
    showTutor2 === initialShowTutor2.current &&
    sameAddressT1 === initialSameAddressT1.current

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Marquer tous les champs comme touchés pour afficher toutes les erreurs
    setTouched(new Set(Object.keys(form)))
    setError(null)

    if (v.t1LastName || v.t1FirstName || v.t1Email) return
    if (showTutor2 && (v.t2LastName || v.t2FirstName || v.t2Email)) return

    setIsSubmitting(true)
    try {
      // Vérification doublon tuteur 1 (insensible casse et accents)
      const supabase = createClient()
      const { data: sameT1Last } = await supabase
        .from('parents')
        .select('id, tutor1_last_name, tutor1_first_name')
        .ilike('tutor1_last_name', form.tutor1_last_name.trim())
      const normT1First = normalizeNom(form.tutor1_first_name)
      const dupT1 = sameT1Last?.find(p =>
        p.id !== parent?.id &&
        normalizeNom(p.tutor1_first_name) === normT1First
      )
      if (dupT1) {
        setError(`Un tuteur "${dupT1.tutor1_last_name} ${dupT1.tutor1_first_name}" existe déjà dans une autre fiche parents.`)
        setIsSubmitting(false)
        return
      }

      // Vérification doublon tuteur 2 (si renseigné)
      if (showTutor2 && form.tutor2_last_name.trim() && form.tutor2_first_name.trim()) {
        const { data: sameT2Last } = await supabase
          .from('parents')
          .select('id, tutor2_last_name, tutor2_first_name')
          .ilike('tutor2_last_name', form.tutor2_last_name.trim())
        const normT2First = normalizeNom(form.tutor2_first_name)
        const dupT2 = sameT2Last?.find(p =>
          p.id !== parent?.id &&
          p.tutor2_last_name &&
          normalizeNom(p.tutor2_first_name ?? '') === normT2First
        )
        if (dupT2) {
          setError(`Un tuteur 2 "${dupT2.tutor2_last_name} ${dupT2.tutor2_first_name}" existe déjà dans une autre fiche parents.`)
          setIsSubmitting(false)
          return
        }
      }

      const t1Phone = form.tutor1_phone_number
        ? form.tutor1_phone_code + form.tutor1_phone_number
        : null
      const t2Phone = showTutor2 && form.tutor2_phone_number
        ? form.tutor2_phone_code + form.tutor2_phone_number
        : null

      const payload = {
        tutor1_last_name:    form.tutor1_last_name.trim(),
        tutor1_first_name:   form.tutor1_first_name.trim(),
        tutor1_relationship: form.tutor1_relationship,
        tutor1_phone:        t1Phone,
        tutor1_email:        clean(form.tutor1_email),
        tutor1_address:      clean(form.tutor1_address),
        tutor1_city:         clean(form.tutor1_city),
        tutor1_postal_code:  clean(form.tutor1_postal_code),
        tutor1_profession:   clean(form.tutor1_profession),
        tutor2_last_name:    showTutor2 ? clean(form.tutor2_last_name)   : null,
        tutor2_first_name:   showTutor2 ? clean(form.tutor2_first_name)  : null,
        tutor2_relationship: showTutor2 && form.tutor2_last_name.trim()
                               ? form.tutor2_relationship : null,
        tutor2_phone:        t2Phone,
        tutor2_email:        showTutor2 ? clean(form.tutor2_email)       : null,
        tutor2_address:      showTutor2 ? (sameAddressT1 ? clean(form.tutor1_address)     : clean(form.tutor2_address))     : null,
        tutor2_city:         showTutor2 ? (sameAddressT1 ? clean(form.tutor1_city)        : clean(form.tutor2_city))        : null,
        tutor2_postal_code:  showTutor2 ? (sameAddressT1 ? clean(form.tutor1_postal_code) : clean(form.tutor2_postal_code)) : null,
        tutor2_profession:    showTutor2 ? clean(form.tutor2_profession) : null,
        tutor1_adult_courses: form.tutor1_adult_courses,
        tutor2_adult_courses: showTutor2 ? form.tutor2_adult_courses : false,
        situation_familiale:  form.situation_familiale || null,
        type_garde:           SITUATIONS_WITH_GARDE.has(form.situation_familiale)
                                ? (form.type_garde || null)
                                : null,
        notes:                clean(form.notes),
      }

      if (isEditing) {
        await parentRepository.update(parent!.id, payload as any)
      } else {
        await parentRepository.create(payload as any)
      }

      router.refresh()
      if (onClose) {
        onClose()
      } else {
        router.push('/dashboard/parents')
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
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

      {/* ── Grille tuteurs : 1 col → 2 cols (xl) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">

        {/* ── Colonne Tuteur 1 ── */}
        <div className="flex flex-col gap-2">

          {/* Infos tuteur 1 */}
          <div className="card p-3 space-y-2">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
              Tuteur 1 — Responsable principal
            </h2>

            <div className="grid grid-cols-2 gap-2">
              <Field label={<>Nom <span className="text-red-400">*</span></>} error={invalid('tutor1_last_name', v.t1LastName) ? 'Minimum 2 caractères' : undefined}>
                <input
                  type="text"
                  value={form.tutor1_last_name}
                  onChange={e => set('tutor1_last_name', toUpperCase(e.target.value))}
                  onBlur={() => touch('tutor1_last_name')}
                  className={cls('tutor1_last_name', v.t1LastName)}
                />
              </Field>
              <Field label={<>Prénom <span className="text-red-400">*</span></>} error={invalid('tutor1_first_name', v.t1FirstName) ? 'Minimum 2 caractères' : undefined}>
                <input
                  type="text"
                  value={form.tutor1_first_name}
                  onChange={e => set('tutor1_first_name', toTitleCase(e.target.value))}
                  onBlur={() => touch('tutor1_first_name')}
                  className={cls('tutor1_first_name', v.t1FirstName)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Qualité">
                <select
                  value={form.tutor1_relationship}
                  onChange={e => set('tutor1_relationship', e.target.value)}
                  className="input"
                >
                  {RELATIONSHIP_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Profession">
                <input
                  type="text"
                  value={form.tutor1_profession}
                  onChange={e => set('tutor1_profession', e.target.value)}
                  className="input"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Téléphone">
                <PhoneInput
                  codeValue={form.tutor1_phone_code}
                  numberValue={form.tutor1_phone_number}
                  onCodeChange={v => set('tutor1_phone_code', v)}
                  onNumberChange={v => set('tutor1_phone_number', digitsOnly(v))}
                />
              </Field>
              <Field label={<>Email <span className="text-red-400">*</span></>} error={invalid('tutor1_email', v.t1Email) ? 'Email invalide' : undefined}>
                <input
                  type="email"
                  value={form.tutor1_email}
                  onChange={e => set('tutor1_email', e.target.value)}
                  onBlur={() => touch('tutor1_email')}
                  className={cls('tutor1_email', v.t1Email)}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 cursor-pointer group w-fit">
              <input
                type="checkbox"
                checked={form.tutor1_adult_courses}
                onChange={e => setForm(prev => ({ ...prev, tutor1_adult_courses: e.target.checked }))}
                className="w-4 h-4 rounded accent-amber-500 flex-shrink-0"
              />
              <span className="text-xs text-warm-500 group-hover:text-warm-600 select-none">Inscrit aux cours adultes</span>
            </label>
          </div>

          {/* Adresse tuteur 1 */}
          <div className="card p-3 space-y-2">
            <Field label="Adresse">
              <input
                type="text"
                value={form.tutor1_address}
                onChange={e => set('tutor1_address', e.target.value)}
                className="input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Ville">
                <input
                  type="text"
                  value={form.tutor1_city}
                  onChange={e => set('tutor1_city', e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Code postal">
                <input
                  type="text"
                  value={form.tutor1_postal_code}
                  onChange={e => set('tutor1_postal_code', e.target.value)}
                  className="input"
                />
              </Field>
            </div>
          </div>

        </div>{/* fin colonne tuteur 1 */}

        {/* ── Colonne Tuteur 2 ── */}
        <div className="flex flex-col gap-2">

          {/* Infos tuteur 2 */}
          <div className="card p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={showTutor2}
                onChange={e => setShowTutor2(e.target.checked)}
                className="w-4 h-4 rounded accent-amber-500 flex-shrink-0"
              />
              <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest group-hover:text-warm-600">
                Tuteur 2 — Responsable secondaire
              </h2>
            </label>

            {showTutor2 ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={<>Nom <span className="text-red-400">*</span></>} error={invalid('tutor2_last_name', v.t2LastName) ? 'Minimum 2 caractères' : undefined}>
                    <input
                      type="text"
                      value={form.tutor2_last_name}
                      onChange={e => set('tutor2_last_name', toUpperCase(e.target.value))}
                      onBlur={() => touch('tutor2_last_name')}
                      className={cls('tutor2_last_name', v.t2LastName)}
                    />
                  </Field>
                  <Field label={<>Prénom <span className="text-red-400">*</span></>} error={invalid('tutor2_first_name', v.t2FirstName) ? 'Minimum 2 caractères' : undefined}>
                    <input
                      type="text"
                      value={form.tutor2_first_name}
                      onChange={e => set('tutor2_first_name', toTitleCase(e.target.value))}
                      onBlur={() => touch('tutor2_first_name')}
                      className={cls('tutor2_first_name', v.t2FirstName)}
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Qualité">
                    <select
                      value={form.tutor2_relationship}
                      onChange={e => set('tutor2_relationship', e.target.value)}
                      className="input"
                    >
                      {RELATIONSHIP_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Profession">
                    <input
                      type="text"
                      value={form.tutor2_profession}
                      onChange={e => set('tutor2_profession', e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Téléphone">
                    <PhoneInput
                      codeValue={form.tutor2_phone_code}
                      numberValue={form.tutor2_phone_number}
                      onCodeChange={v => set('tutor2_phone_code', v)}
                      onNumberChange={v => set('tutor2_phone_number', digitsOnly(v))}
                    />
                  </Field>
                  <Field label={<>Email <span className="text-red-400">*</span></>} error={invalid('tutor2_email', v.t2Email) ? 'Email invalide' : undefined}>
                    <input
                      type="email"
                      value={form.tutor2_email}
                      onChange={e => set('tutor2_email', e.target.value)}
                      onBlur={() => touch('tutor2_email')}
                      className={cls('tutor2_email', v.t2Email)}
                    />
                  </Field>
                </div>

                <label className="flex items-center gap-2 cursor-pointer group w-fit">
                  <input
                    type="checkbox"
                    checked={form.tutor2_adult_courses}
                    onChange={e => setForm(prev => ({ ...prev, tutor2_adult_courses: e.target.checked }))}
                    className="w-4 h-4 rounded accent-amber-500 flex-shrink-0"
                  />
                  <span className="text-xs text-warm-500 group-hover:text-warm-600 select-none">Inscrit aux cours adultes</span>
                </label>
              </>
            ) : (
              <p className="text-xs text-warm-300 italic">
                Cochez la case ci-dessus pour renseigner un second responsable.
              </p>
            )}
          </div>

          {/* Adresse tuteur 2 */}
          {showTutor2 && (
            <div className="card p-3 space-y-2">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Adresse</span>
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={sameAddressT1}
                      onChange={e => setSameAddressT1(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-amber-500"
                    />
                    <span className="text-xs text-warm-400 group-hover:text-warm-500 select-none">
                      Identique tuteur 1
                    </span>
                  </label>
                </div>
                {sameAddressT1 ? (
                  <div className="input bg-warm-100 text-secondary-500 text-sm cursor-default">
                    {form.tutor1_address || <span className="text-warm-300 italic">Non renseignée</span>}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={form.tutor2_address}
                    onChange={e => set('tutor2_address', e.target.value)}
                    className="input"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Ville">
                  {sameAddressT1 ? (
                    <div className="input bg-warm-100 text-secondary-500 text-sm cursor-default">
                      {form.tutor1_city || <span className="text-warm-300 italic">—</span>}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={form.tutor2_city}
                      onChange={e => set('tutor2_city', e.target.value)}
                      className="input"
                    />
                  )}
                </Field>
                <Field label="Code postal">
                  {sameAddressT1 ? (
                    <div className="input bg-warm-100 text-secondary-500 text-sm cursor-default">
                      {form.tutor1_postal_code || <span className="text-warm-300 italic">—</span>}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={form.tutor2_postal_code}
                      onChange={e => set('tutor2_postal_code', e.target.value)}
                      className="input"
                    />
                  )}
                </Field>
              </div>
            </div>
          )}

        </div>{/* fin colonne tuteur 2 */}

      </div>{/* fin grille tuteurs */}

      {/* ── Situation familiale ── */}
      <div className="card p-3 space-y-2">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
          Situation familiale
        </h2>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
              Situation
            </label>
            <select
              value={form.situation_familiale}
              onChange={e => {
                const val = e.target.value
                setForm(prev => ({
                  ...prev,
                  situation_familiale: val,
                  type_garde: SITUATIONS_WITH_GARDE.has(val) ? prev.type_garde : '',
                }))
              }}
              className="input"
            >
              {SITUATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {SITUATIONS_WITH_GARDE.has(form.situation_familiale) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
                Type de garde
              </label>
              <div className="flex flex-wrap gap-2">
                {GARDE_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors select-none',
                      form.type_garde === opt.value
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-warm-200 text-secondary-700 hover:bg-warm-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="type_garde"
                      value={opt.value}
                      checked={form.type_garde === opt.value}
                      onChange={() => setForm(prev => ({ ...prev, type_garde: opt.value }))}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
            Commentaires complémentaires
          </label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="Informations utiles, contexte particulier…"
            className="input resize-none"
          />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="button"
          onClick={() => onClose ? onClose() : router.push('/dashboard/parents')}
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
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}

function PhoneInput({
  codeValue,
  numberValue,
  onCodeChange,
  onNumberChange,
}: {
  codeValue: string
  numberValue: string
  onCodeChange: (v: string) => void
  onNumberChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = COUNTRY_CODES.find(c => c.code === codeValue) ?? COUNTRY_CODES[0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="flex gap-2">
      <div ref={ref} className="relative flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="input h-full flex items-center gap-1.5 px-3 cursor-pointer select-none whitespace-nowrap"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={flagUrl(selected.iso)} alt={selected.name} className="w-5 h-auto rounded-sm flex-shrink-0" />
          <span className="text-xs text-warm-500 font-mono">{selected.code}</span>
          <ChevronDown size={12} className="text-warm-400" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-warm-200 rounded-xl shadow-lg overflow-y-auto max-h-52 w-48 py-1">
            {COUNTRY_CODES.map(c => (
              <button
                key={c.code}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onCodeChange(c.code); setOpen(false) }}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  c.code === codeValue
                    ? 'bg-primary-50 text-primary-700'
                    : 'hover:bg-warm-50 text-secondary-700'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={flagUrl(c.iso)} alt={c.name} className="w-5 h-auto rounded-sm flex-shrink-0" />
                <span className="font-mono text-xs w-10 flex-shrink-0">{c.code}</span>
                <span className="text-xs truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        type="text"
        inputMode="numeric"
        value={numberValue}
        onChange={e => onNumberChange(e.target.value)}
        className="input flex-1 min-w-0"
      />
    </div>
  )
}
