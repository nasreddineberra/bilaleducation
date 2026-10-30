'use client'

import { useState, useRef } from 'react'
import { clsx } from 'clsx'
import { useRouter } from 'next/navigation'
import { createParentWithAccounts, updateParentRecord, type TutorAccountResult, type CreateParentPayload, type UpdateParentPayload } from '@/app/dashboard/parents/actions'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatSelect, FloatTextarea, FloatButton, SwitchOuiNon } from '@/components/ui/FloatFields'
import { FloatPhoneInput, COUNTRY_CODES } from '@/components/ui/FloatPhoneInput'
import { SITUATIONS_FAMILIALES, libelleSituation } from '@/lib/parents/situation-familiale'
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

const parsePhone = (phone?: string | null): { code: string; number: string } => {
  if (!phone) return { code: '+33', number: '' }
  const country = COUNTRY_CODES.find(c => phone.startsWith(c.code))
  return country
    ? { code: country.code, number: digitsOnly(phone.slice(country.code.length)) }
    : { code: '+33', number: digitsOnly(phone) }
}


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
  tutor1_relationship: TutorRelationship | ''
  tutor1_phone_code:   string
  tutor1_phone_number: string
  tutor1_email:        string
  tutor1_address:      string
  tutor1_city:         string
  tutor1_postal_code:  string
  tutor1_profession:   string
  tutor2_last_name:    string
  tutor2_first_name:   string
  tutor2_relationship: TutorRelationship | ''
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
  /** Ou revenir apres enregistrement. Par defaut la liste des foyers, mais
   *  l'AUDIT quand on vient de lui — voir `lib/navigation/retour`. */
  backHref?: string
  parent?: Parent
  onClose?: () => void
  /** Tuteur inscrit a une classe adulte → case « Inscrit aux cours adultes » grisee. */
  tutor1AdultEnrolled?: boolean
  tutor2AdultEnrolled?: boolean
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ParentForm({ parent, onClose, backHref = '/dashboard/parents', tutor1AdultEnrolled = false, tutor2AdultEnrolled = false }: ParentFormProps) {
  const router    = useRouter()
  const toast     = useToast()
  const isEditing = !!parent

  const t1Phone = parsePhone(parent?.tutor1_phone)
  const t2Phone = parsePhone(parent?.tutor2_phone)

  const [form, setForm] = useState<FormData>({
    tutor1_last_name:    parent?.tutor1_last_name    ?? '',
    tutor1_first_name:   parent?.tutor1_first_name   ?? '',
    tutor1_relationship: parent?.tutor1_relationship ?? '',
    tutor1_phone_code:   t1Phone.code,
    tutor1_phone_number: t1Phone.number,
    tutor1_email:        parent?.tutor1_email        ?? '',
    tutor1_address:      parent?.tutor1_address      ?? '',
    tutor1_city:         parent?.tutor1_city         ?? '',
    tutor1_postal_code:  parent?.tutor1_postal_code  ?? '',
    tutor1_profession:   parent?.tutor1_profession   ?? '',
    tutor2_last_name:    parent?.tutor2_last_name    ?? '',
    tutor2_first_name:   parent?.tutor2_first_name   ?? '',
    tutor2_relationship: parent?.tutor2_relationship ?? '',
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
  // « Identique tuteur 1 » : OUI par defaut a la creation (cas le plus
  // frequent). Sur une fiche existante, oui seulement si l'adresse du tuteur 2
  // est reellement celle du tuteur 1 (ou vide) : sinon on masquerait une
  // adresse differente deja saisie.
  const adresseIdentique = !parent || (
    (parent.tutor2_address ?? '') === (parent.tutor1_address ?? '') &&
    (parent.tutor2_city ?? '') === (parent.tutor1_city ?? '') &&
    (parent.tutor2_postal_code ?? '') === (parent.tutor1_postal_code ?? '')
  ) || (!parent.tutor2_address && !parent.tutor2_city && !parent.tutor2_postal_code)
  const initialSameAddressT1  = useRef(adresseIdentique)

  const [showTutor2,         setShowTutor2]         = useState(!!parent?.tutor2_last_name)
  const [sameAddressT1,      setSameAddressT1]      = useState(adresseIdentique)
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
    t1Rel:       !form.tutor1_relationship,
    t2LastName:  form.tutor2_last_name.trim().length  < 2,
    t2FirstName: form.tutor2_first_name.trim().length < 2,
    t2Email:     !form.tutor2_email || !isValidEmail(form.tutor2_email),
    t2Rel:       !form.tutor2_relationship,
  }

  const isFormValid = !v.t1LastName && !v.t1FirstName && !v.t1Email && !v.t1Rel &&
    (!showTutor2 || (!v.t2LastName && !v.t2FirstName && !v.t2Email && !v.t2Rel))

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
      // ── PLUS DE CONTROLE DE DOUBLON ICI ──────────────────────────────
      //
      // Il y en avait un, et il donnait une fausse assurance : il comparait le
      // tuteur 1 aux SEULS tuteurs 1 et le tuteur 2 aux SEULS tuteurs 2. La
      // meme personne pouvait donc etre tuteur 1 du foyer A et tuteur 2 du
      // foyer B sans que rien ne le signale — et rien n'empechait non plus de
      // la saisir aux deux rangs du meme foyer. Son `.ilike` sur le nom
      // ignorait de surcroit les accents.
      //
      // La regle vit desormais en base (declencheur `trg_guard_parents_unique_tutor`),
      // qui couvre les quatre rapprochements croises d'un coup et porte le nom
      // du foyer en conflit. La server action fait remonter SON message tel
      // quel : le reformuler ici perdrait ce nom, qui est ce qui permet d'agir.

      const t1Phone = form.tutor1_phone_number
        ? form.tutor1_phone_code + form.tutor1_phone_number
        : null
      const t2Phone = showTutor2 && form.tutor2_phone_number
        ? form.tutor2_phone_code + form.tutor2_phone_number
        : null

      const payload = {
        tutor1_last_name:    form.tutor1_last_name.trim(),
        tutor1_first_name:   form.tutor1_first_name.trim(),
        tutor1_relationship: form.tutor1_relationship as TutorRelationship,
        tutor1_phone:        t1Phone,
        tutor1_email:        clean(form.tutor1_email),
        tutor1_address:      clean(form.tutor1_address),
        tutor1_city:         clean(form.tutor1_city),
        tutor1_postal_code:  clean(form.tutor1_postal_code),
        tutor1_profession:   clean(form.tutor1_profession),
        tutor2_last_name:    showTutor2 ? clean(form.tutor2_last_name)   : null,
        tutor2_first_name:   showTutor2 ? clean(form.tutor2_first_name)  : null,
        tutor2_relationship: showTutor2 && form.tutor2_last_name.trim()
                               ? (form.tutor2_relationship || null) as TutorRelationship | null : null,
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
        const result = await updateParentRecord(parent!.id, payload as UpdateParentPayload)
        if (result.error) {
          toast.error(result.error)
          setIsSubmitting(false)
          return
        }
        router.refresh()
        if (onClose) {
          onClose()
        } else {
          // Modification : on RESTE sur la fiche (retour a la liste manuel, decision du 30/10) ;
          // la page rechargee remonte le formulaire (cle `updated_at`).
          toast.success('Fiche parents modifiée avec succès.')
        }
      } else {
        // Création avec comptes utilisateurs automatiques
        const result = await createParentWithAccounts(payload as CreateParentPayload)
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
            router.push(backHref)
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
          <p className="text-sm text-warm-700">
            {createdAccounts.length === 1 ? 'Un compte utilisateur a été créé' : `${createdAccounts.length} comptes utilisateurs ont été créés`} automatiquement.
          </p>
          {createdAccounts.map((acc, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">{acc.tutorLabel}</p>
              <p className="text-sm text-secondary-700">{acc.email}</p>
              <p className="text-xs text-warm-700 mt-1">Mot de passe temporaire :</p>
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
                router.push(backHref)
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

      {/* En-tête de fiche (édition) : qui édite-t-on */}
      {isEditing && parent && (
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 select-none bg-warm-100 text-warm-700 ring-1 ring-warm-200">
            {`${(parent.tutor1_last_name?.[0] ?? '').toUpperCase()}${(parent.tutor1_first_name?.[0] ?? '').toUpperCase()}`}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-secondary-800 leading-tight truncate">
              {parent.tutor1_last_name} {parent.tutor1_first_name}
              {parent.tutor2_last_name && (
                <span className="text-warm-700 font-medium"> &amp; {parent.tutor2_last_name} {parent.tutor2_first_name}</span>
              )}
            </h1>
            <div className="flex items-center gap-2 text-xs text-warm-700 mt-0.5 flex-wrap">
              {parent.situation_familiale
                ? <span>{libelleSituation(parent.situation_familiale)}</span>
                : <span className="text-warm-700 italic">Situation non renseignée</span>}
              {(parent.tutor1_adult_courses || parent.tutor2_adult_courses) && (
                <span className="font-medium text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">Cours adultes</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Grille tuteurs : 1 col → 2 cols (xl) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start">

        {/* ── Colonne Tuteur 1 ── */}
        <div className="flex flex-col gap-2">

          {/* Infos tuteur 1 */}
          <div className="card p-3 space-y-2">
            <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">
              Tuteur 1 · Responsable principal
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
                required
                value={form.tutor1_relationship}
                onChange={e => set('tutor1_relationship', e.target.value)}
              >
                <option value="" disabled hidden></option>
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

            <SwitchOuiNon
              label="Inscrit aux cours adultes"
              checked={form.tutor1_adult_courses}
              disabled={tutor1AdultEnrolled}
              onChange={val => setForm(prev => ({ ...prev, tutor1_adult_courses: val }))}
            />
          </div>

          {/* Adresse tuteur 1 */}
          <div className="card p-3 space-y-2">
            <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">Adresse</h2>
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
            {/* Titre a gauche, switch Oui / Non a droite. Hauteur figee a celle
                du titre du tuteur 1 (h-4) : les champs des deux colonnes restent
                alignes ; le switch compact (~17 px) deborde d'un pixel, sans effet. */}
            <div className="encadre-titre flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest">
                Tuteur 2 · Responsable secondaire
              </h2>
              <SwitchOuiNon
                seul
                label="Tuteur 2 · Responsable secondaire"
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
                    required
                    value={form.tutor2_relationship}
                    onChange={e => set('tutor2_relationship', e.target.value)}
                  >
                    <option value="" disabled hidden></option>
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

                <SwitchOuiNon
                  label="Inscrit aux cours adultes"
                  checked={form.tutor2_adult_courses}
                  disabled={tutor2AdultEnrolled}
                  onChange={val => setForm(prev => ({ ...prev, tutor2_adult_courses: val }))}
                />
              </>
            ) : (
              <p className="text-xs text-warm-700 italic">
                Choisissez « Oui » ci-dessus pour renseigner un second responsable.
              </p>
            )}
          </div>

          {/* Adresse tuteur 2 */}
          {showTutor2 && (
            <div className="card p-3 space-y-2">
              {/* Meme en-tete que le titre du tuteur 2 : hauteur h-4, switch
                  compact a droite, precede de son libelle. */}
              <div className="encadre-titre flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest">Adresse</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-warm-700">Identique tuteur 1</span>
                  <SwitchOuiNon
                    seul
                    label="Adresse identique à celle du tuteur 1"
                    checked={sameAddressT1}
                    onChange={setSameAddressT1}
                  />
                </div>
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
        <div className="encadre-titre flex gap-3">
          <h2 className="min-w-[200px] text-xs font-bold uppercase tracking-widest">
            Situation familiale
          </h2>
          {SITUATIONS_WITH_GARDE.has(form.situation_familiale) && (
            <span className="text-xs font-bold uppercase tracking-widest">
              Type de garde
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-start gap-3">
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
              {SITUATIONS_FAMILIALES.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </FloatSelect>
          </div>

          {SITUATIONS_WITH_GARDE.has(form.situation_familiale) && (
            // SWITCH segmente (charte du 15/10), a la hauteur du champ Situation.
            // Aucun segment actif tant qu'aucun type de garde n'est choisi.
            <div role="radiogroup" aria-label="Type de garde" className="flex flex-wrap rounded-lg overflow-hidden text-sm font-medium border border-warm-300">
              {GARDE_OPTIONS.map((opt, i) => {
                const actif = form.type_garde === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => setForm(prev => ({ ...prev, type_garde: opt.value }))}
                    className={clsx(
                      'px-3 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300',
                      i > 0 && 'border-l border-warm-300',
                      actif
                        ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]'
                        : 'bg-white text-warm-700 hover:bg-warm-50',
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
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

      {/* Note « comptes parents créés automatiquement » retirée : création suspendue en V1. */}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton
          type="button"
          variant="secondary"
          onClick={() => onClose ? onClose() : router.push(backHref)}
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

