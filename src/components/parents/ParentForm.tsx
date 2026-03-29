'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createParentWithAccounts, updateParentRecord, type TutorAccountResult } from '@/app/dashboard/parents/actions'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatSelect, FloatCheckbox, FloatTextarea, FloatButton, FloatRadioCard } from '@/components/ui/FloatFields'
import { FloatPhoneInput, COUNTRY_CODES } from '@/components/ui/FloatPhoneInput'
import type { Parent, TutorRelationship } from '@/types/database'


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
    ? { code: country.code, number: digitsOnly(phone.slice(country.code.length)) }
    : { code: '+33', number: digitsOnly(phone) }
}

// ─── Situation familiale ──────────────────────────────────────────────────────
const SITUATION_OPTIONS = [
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

interface ParentFormProps {
  parent?: Parent
  onClose?: () => void
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ParentForm({ parent, onClose }: ParentFormProps) {
  const router    = useRouter()
  const toast     = useToast()
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
  const [createdAccounts,    setCreatedAccounts]    = useState<TutorAccountResult[] | null>(null)

  const set   = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  // Retourne true si le champ est invalide ET a déjà été touché
  const invalid = (field: string, bad: boolean) => touched.has(field) && bad

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
        toast.error(`Un tuteur "${dupT1.tutor1_last_name} ${dupT1.tutor1_first_name}" existe déjà dans une autre fiche parents.`)
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
          toast.error(`Un tuteur 2 "${dupT2.tutor2_last_name} ${dupT2.tutor2_first_name}" existe déjà dans une autre fiche parents.`)
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
        const result = await updateParentRecord(parent!.id, payload)
        if (result.error) {
          toast.error(result.error)
          setIsSubmitting(false)
          return
        }
        router.refresh()
        if (onClose) {
          onClose()
        } else {
          router.push('/dashboard/parents')
        }
      } else {
        // Création avec comptes utilisateurs automatiques
        const result = await createParentWithAccounts(payload)
        if (result.error) {
          toast.error(result.error)
          setIsSubmitting(false)
          return
        }
        // Si des comptes ont été créés, afficher les mots de passe
        if (result.accounts && result.accounts.length > 0) {
          setCreatedAccounts(result.accounts)
        } else {
          router.refresh()
          if (onClose) {
            onClose()
          } else {
            router.push('/dashboard/parents')
          }
        }
      }
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Affichage mots de passe temporaires après création ──────────────────

  if (createdAccounts) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-bold text-secondary-800">Fiche parents et comptes utilisateurs créés</h2>
          <p className="text-sm text-warm-600">
            {createdAccounts.length === 1 ? 'Un compte utilisateur a été créé' : `${createdAccounts.length} comptes utilisateurs ont été créés`} automatiquement.
          </p>
          {createdAccounts.map((acc, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">{acc.tutorLabel}</p>
              <p className="text-sm text-secondary-700">{acc.email}</p>
              <p className="text-xs text-warm-500 mt-1">Mot de passe temporaire :</p>
              <p className="text-lg font-mono font-bold text-secondary-800 select-all">{acc.tempPassword}</p>
            </div>
          ))}
          <p className="text-xs text-amber-600">
            Notez ces mots de passe maintenant. Ils ne seront plus affichés. L'administrateur pourra envoyer un email de réinitialisation depuis la page Utilisateurs.
          </p>
          <FloatButton
            variant="submit"
            className="w-full justify-center"
            onClick={() => {
              router.refresh()
              if (onClose) {
                onClose()
              } else {
                router.push('/dashboard/parents')
              }
            }}
          >
            Retour à la liste
          </FloatButton>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2 max-w-5xl">

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
              <FloatInput
                label="Nom"
                required
                value={form.tutor1_last_name}
                onChange={e => set('tutor1_last_name', toUpperCase(e.target.value))}
                onBlur={() => touch('tutor1_last_name')}
                error={invalid('tutor1_last_name', v.t1LastName) ? 'Minimum 2 caractères' : undefined}
              />
              <FloatInput
                label="Prénom"
                required
                value={form.tutor1_first_name}
                onChange={e => set('tutor1_first_name', toTitleCase(e.target.value))}
                onBlur={() => touch('tutor1_first_name')}
                error={invalid('tutor1_first_name', v.t1FirstName) ? 'Minimum 2 caractères' : undefined}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FloatSelect
                label="Qualité"
                value={form.tutor1_relationship}
                onChange={e => set('tutor1_relationship', e.target.value)}
              >
                {RELATIONSHIP_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </FloatSelect>
              <FloatInput
                label="Profession"
                value={form.tutor1_profession}
                onChange={e => set('tutor1_profession', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FloatPhoneInput
                codeValue={form.tutor1_phone_code}
                numberValue={form.tutor1_phone_number}
                onCodeChange={v => set('tutor1_phone_code', v)}
                onNumberChange={v => set('tutor1_phone_number', digitsOnly(v))}
              />
              <FloatInput
                label="Email"
                required
                type="email"
                value={form.tutor1_email}
                onChange={e => set('tutor1_email', e.target.value)}
                onBlur={() => touch('tutor1_email')}
                error={invalid('tutor1_email', v.t1Email) ? 'Email invalide' : undefined}
              />
            </div>

            <FloatCheckbox
              variant="compact"
              label="Inscrit aux cours adultes"
              checked={form.tutor1_adult_courses}
              onChange={val => setForm(prev => ({ ...prev, tutor1_adult_courses: val }))}
            />
          </div>

          {/* Adresse tuteur 1 */}
          <div className="card p-3 space-y-2">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Adresse</h2>
            <FloatInput
              label="Adresse"
              value={form.tutor1_address}
              onChange={e => set('tutor1_address', e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <FloatInput
                label="Ville"
                value={form.tutor1_city}
                onChange={e => set('tutor1_city', e.target.value)}
              />
              <FloatInput
                label="Code postal"
                value={form.tutor1_postal_code}
                onChange={e => set('tutor1_postal_code', e.target.value)}
              />
            </div>
          </div>

        </div>{/* fin colonne tuteur 1 */}

        {/* ── Colonne Tuteur 2 ── */}
        <div className="flex flex-col gap-2">

          {/* Infos tuteur 2 */}
          <div className="card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FloatCheckbox
                variant="compact"
                label="Tuteur 2 — Responsable secondaire"
                checked={showTutor2}
                onChange={setShowTutor2}
              />
            </div>

            {showTutor2 ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <FloatInput
                    label="Nom"
                    required
                    value={form.tutor2_last_name}
                    onChange={e => set('tutor2_last_name', toUpperCase(e.target.value))}
                    onBlur={() => touch('tutor2_last_name')}
                    error={invalid('tutor2_last_name', v.t2LastName) ? 'Minimum 2 caractères' : undefined}
                  />
                  <FloatInput
                    label="Prénom"
                    required
                    value={form.tutor2_first_name}
                    onChange={e => set('tutor2_first_name', toTitleCase(e.target.value))}
                    onBlur={() => touch('tutor2_first_name')}
                    error={invalid('tutor2_first_name', v.t2FirstName) ? 'Minimum 2 caractères' : undefined}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <FloatSelect
                    label="Qualité"
                    value={form.tutor2_relationship}
                    onChange={e => set('tutor2_relationship', e.target.value)}
                  >
                    {RELATIONSHIP_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </FloatSelect>
                  <FloatInput
                    label="Profession"
                    value={form.tutor2_profession}
                    onChange={e => set('tutor2_profession', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <FloatPhoneInput
                    codeValue={form.tutor2_phone_code}
                    numberValue={form.tutor2_phone_number}
                    onCodeChange={v => set('tutor2_phone_code', v)}
                    onNumberChange={v => set('tutor2_phone_number', digitsOnly(v))}
                  />
                  <FloatInput
                    label="Email"
                    required
                    type="email"
                    value={form.tutor2_email}
                    onChange={e => set('tutor2_email', e.target.value)}
                    onBlur={() => touch('tutor2_email')}
                    error={invalid('tutor2_email', v.t2Email) ? 'Email invalide' : undefined}
                  />
                </div>

                <FloatCheckbox
                  variant="compact"
                  label="Inscrit aux cours adultes"
                  checked={form.tutor2_adult_courses}
                  onChange={val => setForm(prev => ({ ...prev, tutor2_adult_courses: val }))}
                />
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
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Adresse</h2>
                <FloatCheckbox
                  variant="compact"
                  label="Identique tuteur 1"
                  checked={sameAddressT1}
                  onChange={setSameAddressT1}
                />
              </div>
              <FloatInput
                label="Adresse"
                locked={sameAddressT1}
                value={sameAddressT1 ? (form.tutor1_address || '') : form.tutor2_address}
                onChange={e => set('tutor2_address', e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <FloatInput
                  label="Ville"
                  locked={sameAddressT1}
                  value={sameAddressT1 ? (form.tutor1_city || '') : form.tutor2_city}
                  onChange={e => set('tutor2_city', e.target.value)}
                />
                <FloatInput
                  label="Code postal"
                  locked={sameAddressT1}
                  value={sameAddressT1 ? (form.tutor1_postal_code || '') : form.tutor2_postal_code}
                  onChange={e => set('tutor2_postal_code', e.target.value)}
                />
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

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <FloatSelect
              label="Situation"
              value={form.situation_familiale}
              onChange={e => {
                const val = e.target.value
                setForm(prev => ({
                  ...prev,
                  situation_familiale: val,
                  type_garde: SITUATIONS_WITH_GARDE.has(val) ? prev.type_garde : '',
                }))
              }}
            >
              <option value=""></option>
              {SITUATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </FloatSelect>
          </div>

          {SITUATIONS_WITH_GARDE.has(form.situation_familiale) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
                Type de garde
              </label>
              <div className="flex flex-wrap gap-2">
                {GARDE_OPTIONS.map(opt => (
                  <FloatRadioCard
                    key={opt.value}
                    name="type_garde"
                    value={opt.value}
                    checked={form.type_garde === opt.value}
                    onChange={() => setForm(prev => ({ ...prev, type_garde: opt.value }))}
                  >
                    {opt.label}
                  </FloatRadioCard>
                ))}
              </div>
            </div>
          )}
        </div>

        <FloatTextarea
          label="Commentaires complémentaires"
          placeholder="Informations utiles, contexte particulier…"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={2}
        />
      </div>

      {!isEditing && (
        <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            Un compte utilisateur (role parent) sera créé automatiquement pour chaque tuteur ayant un email renseigné, avec un mot de passe temporaire.
          </p>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton
          type="button"
          variant="secondary"
          onClick={() => onClose ? onClose() : router.push('/dashboard/parents')}
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

