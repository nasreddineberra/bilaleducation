'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { ExternalLink, Loader2, X, Upload, Camera, Trash2, User, Users } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import ParentForm from '@/components/parents/ParentForm'
import type { Student, Parent } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParentOption {
  id: string
  tutor1_last_name: string
  tutor1_first_name: string
  tutor1_relationship?: string | null
  tutor1_address?: string | null
  tutor1_city?: string | null
  tutor1_postal_code?: string | null
  tutor1_phone?: string | null
  tutor1_email?: string | null
  tutor2_last_name?: string | null
  tutor2_first_name?: string | null
  tutor2_relationship?: string | null
  tutor2_address?: string | null
  tutor2_city?: string | null
  tutor2_postal_code?: string | null
  tutor2_phone?: string | null
  tutor2_email?: string | null
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  'père':   'Père',
  'mère':   'Mère',
  'tuteur': 'Tuteur légal',
  'autre':  'Autre',
}

const relLabel = (rel?: string | null, fallback = 'Tuteur') =>
  rel ? (RELATIONSHIP_LABEL[rel] ?? rel) : fallback

type SiblingRow = {
  id: string
  last_name: string
  first_name: string
  gender: string | null
  date_of_birth: string
  enrollments: { class_id: string; classes: { id: string; name: string; day_of_week: string | null; start_time: string | null; end_time: string | null } | null }[]
}

type MainTeacherRow = {
  class_id: string
  teachers: { civilite: string | null; first_name: string; last_name: string } | null
}

interface StudentFormProps {
  student?: Student
  parents: ParentOption[]
  defaultStudentNumber?: string
  backHref?: string
  etablissementId?: string
  siblings?: SiblingRow[]
  mainTeachers?: MainTeacherRow[]
}

type FormData = {
  student_number:      string
  last_name:           string
  first_name:          string
  date_of_birth:       string
  gender:              string
  enrollment_date:     string
  parent_id:           string
  is_active:           boolean
  medical_notes:       string
  exit_authorization:  boolean
  media_authorization: boolean
  has_pai:             boolean
  pai_notes:           string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toUpperCase = (v: string) => v.toUpperCase()
const toTitleCase = (v: string) =>
  v.split(' ').map(w => w.length > 0 ? w[0].toUpperCase() + w.slice(1) : '').join(' ')
const clean = (v: string): string | null => v.trim() || null
const today = new Date().toISOString().split('T')[0]
const normalizeNom = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// ─── Composant principal ──────────────────────────────────────────────────────
export default function StudentForm({ student, parents, defaultStudentNumber, backHref = '/dashboard/students', etablissementId = '', siblings = [], mainTeachers = [] }: StudentFormProps) {
  const router    = useRouter()
  const isEditing = !!student

  const [form, setForm] = useState<FormData>({
    student_number:  student?.student_number  ?? defaultStudentNumber ?? '',
    last_name:       student?.last_name       ?? '',
    first_name:      student?.first_name      ?? '',
    date_of_birth:   student?.date_of_birth   ?? '',
    gender:          student?.gender          ?? '',
    enrollment_date: student?.enrollment_date ?? today,
    parent_id:           student?.parent_id           ?? '',
    is_active:           student?.is_active           ?? true,
    medical_notes:       student?.medical_notes       ?? '',
    exit_authorization:  student?.exit_authorization  ?? false,
    media_authorization: student?.media_authorization ?? false,
    has_pai:             student?.has_pai             ?? false,
    pai_notes:           student?.pai_notes           ?? '',
  })

  const originalNumber  = useRef(student?.student_number ?? defaultStudentNumber ?? '')
  const initialForm     = useRef<FormData>({ ...form })

  const [photoUrl,       setPhotoUrl]       = useState<string | null>(student?.photo_url ?? null)
  const [tutorSource,    setTutorSource]    = useState<'tutor1' | 'tutor2'>('tutor1')
  const [numberEditable, setNumberEditable] = useState(false)
  const [touched,        setTouched]        = useState<Set<string>>(new Set())
  const [isSubmitting,    setIsSubmitting]    = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [showParentModal, setShowParentModal] = useState(false)
  const [fullParent,      setFullParent]      = useState<Parent | null>(null)
  const [loadingParent,   setLoadingParent]   = useState(false)

  const handleOpenParentModal = async () => {
    if (!form.parent_id) return
    setLoadingParent(true)
    setShowParentModal(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('parents')
        .select('*')
        .eq('id', form.parent_id)
        .single()
      setFullParent(data ?? null)
    } finally {
      setLoadingParent(false)
    }
  }

  const handleCloseParentModal = () => {
    setShowParentModal(false)
    setFullParent(null)
  }

  const set   = (field: keyof FormData, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  // Validation
  const v = {
    studentNumber: form.student_number.trim().length < 1,
    lastName:      form.last_name.trim().length      < 2,
    firstName:     form.first_name.trim().length     < 2,
    dateOfBirth:   !form.date_of_birth,
    gender:        !form.gender,
  }
  const invalid = (field: string, bad: boolean) => touched.has(field) && bad
  const cls     = (field: string, bad: boolean) =>
    bad && touched.has(field) ? 'input input-error' : 'input'

  // Formulaire valide → bouton actif
  const isFormValid = !v.studentNumber && !v.lastName && !v.firstName && !v.dateOfBirth && !v.gender

  // En modification : bouton grisé si aucune valeur changée
  const isUnchanged = isEditing && (Object.keys(form) as (keyof FormData)[]).every(
    k => form[k] === initialForm.current[k]
  ) && photoUrl === (student?.photo_url ?? null)

  // Parent sélectionné
  const parentData = form.parent_id
    ? parents.find(p => p.id === form.parent_id) ?? null
    : null
  const hasTutor2 = !!(parentData?.tutor2_last_name)

  // Infos du tuteur source sélectionné
  const tutorInfo = parentData
    ? tutorSource === 'tutor1'
      ? {
          name:        `${parentData.tutor1_last_name} ${parentData.tutor1_first_name}`,
          address:     parentData.tutor1_address,
          city:        parentData.tutor1_city,
          postal_code: parentData.tutor1_postal_code,
          phone:       parentData.tutor1_phone,
          email:       parentData.tutor1_email,
        }
      : {
          name:        `${parentData.tutor2_last_name ?? ''} ${parentData.tutor2_first_name ?? ''}`.trim(),
          address:     parentData.tutor2_address,
          city:        parentData.tutor2_city,
          postal_code: parentData.tutor2_postal_code,
          phone:       parentData.tutor2_phone,
          email:       parentData.tutor2_email,
        }
    : null

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
        .from('students')
        .select('id, last_name, first_name')
        .ilike('last_name', form.last_name.trim())
      const normFirst = normalizeNom(form.first_name)
      const duplicate = sameLastName?.find(s =>
        s.id !== student?.id &&
        normalizeNom(s.first_name) === normFirst
      )
      if (duplicate) {
        setError(`Un élève "${duplicate.last_name} ${duplicate.first_name}" existe déjà.`)
        setIsSubmitting(false)
        return
      }

      const payload = {
        student_number:          form.student_number,
        last_name:               form.last_name.trim(),
        first_name:              form.first_name.trim(),
        date_of_birth:           form.date_of_birth,
        gender:                  form.gender || null,
        enrollment_date:         form.enrollment_date,
        parent_id:               form.parent_id || null,
        is_active:               form.is_active,
        // Adresse et contact dérivés du tuteur sélectionné
        address:                 tutorInfo?.address     ?? null,
        city:                    tutorInfo?.city        ?? null,
        postal_code:             tutorInfo?.postal_code ?? null,
        emergency_contact_name:  tutorInfo?.name        ?? null,
        emergency_contact_phone: tutorInfo?.phone       ?? null,
        medical_notes:           clean(form.medical_notes),
        exit_authorization:      form.exit_authorization,
        media_authorization:     form.media_authorization,
        has_pai:                 form.has_pai,
        pai_notes:               clean(form.pai_notes),
        photo_url:               photoUrl,
      }

      if (isEditing) {
        const { error } = await supabase.from('students').update(payload).eq('id', student.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('students').insert(payload)
        if (error) throw error
      }

      router.push(backHref)
      router.refresh()
    } catch (err: any) {
      if (err?.code === '23505') {
        setError("Ce numéro d'élève est déjà utilisé.")
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

        {/* ── Colonne gauche ── */}
        <div className="flex flex-col gap-2">

        {/* Identité de l'élève */}
        <div className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
              Identité de l'élève
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

          <div className="flex gap-4">
            {etablissementId && (
              <PhotoField
                photoUrl={photoUrl}
                studentId={student?.id ?? null}
                etablissementId={etablissementId}
                onChange={setPhotoUrl}
              />
            )}
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* N° élève */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide">N° élève</span>
                    {!isEditing && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={numberEditable}
                          onChange={e => {
                            setNumberEditable(e.target.checked)
                            if (!e.target.checked) set('student_number', originalNumber.current)
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
                      value={form.student_number}
                      onChange={e => set('student_number', e.target.value)}
                      onBlur={() => touch('student_number')}
                      className="input font-mono"
                      autoFocus
                    />
                  ) : (
                    <div className="input bg-warm-100 text-secondary-500 font-mono text-sm select-all cursor-default">
                      {form.student_number}
                    </div>
                  )}
                </div>
                <Field label={<>Date d'inscription <span className="text-red-400">*</span></>}>
                  <input
                    type="date"
                    value={form.enrollment_date}
                    onChange={e => set('enrollment_date', e.target.value)}
                    className="input"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-2">
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

              <div className="grid grid-cols-2 gap-2">
                <Field label={<>Date de naissance <span className="text-red-400">*</span></>} error={invalid('date_of_birth', v.dateOfBirth) ? 'Champ requis' : undefined}>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={e => set('date_of_birth', e.target.value)}
                    onBlur={() => touch('date_of_birth')}
                    className={cls('date_of_birth', v.dateOfBirth)}
                  />
                </Field>
                <Field label={<>Genre <span className="text-red-400">*</span></>} error={invalid('gender', v.gender) ? 'Champ requis' : undefined}>
                  <select
                    value={form.gender}
                    onChange={e => { set('gender', e.target.value); touch('gender') }}
                    onBlur={() => touch('gender')}
                    className={cls('gender', v.gender)}
                  >
                    <option value="">— Choisir —</option>
                    <option value="male">Masculin</option>
                    <option value="female">Féminin</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </div>

        {/* Adresse + Contact d'urgence côte à côte */}
        {parentData && (
          <div className="grid grid-cols-2 gap-2">
            <div className="card p-3 space-y-1.5">
              <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Adresse</h2>
              <InfoBlock>
                <p>{tutorInfo?.address || <span className="text-warm-400 italic">Non renseignée</span>}</p>
                {(tutorInfo?.postal_code || tutorInfo?.city) && (
                  <p className="text-warm-500">
                    {[tutorInfo.postal_code, tutorInfo.city].filter(Boolean).join(' ')}
                  </p>
                )}
              </InfoBlock>
            </div>
            <div className="card p-3 space-y-1.5">
              <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
                Contact d'urgence & Santé
              </h2>
              <InfoBlock>
                <p className="font-medium">{tutorInfo?.name || <span className="text-warm-400 italic">—</span>}</p>
                <p className="font-mono text-xs text-warm-500">{tutorInfo?.phone || '—'}</p>
                <p className="text-warm-500 text-xs">{tutorInfo?.email || '—'}</p>
              </InfoBlock>
            </div>
          </div>
        )}

        </div>{/* fin colonne gauche */}

        {/* ── Colonne droite ── */}
        <div className="flex flex-col gap-2">

          {/* Rattachement parental */}
          <div className="card p-3 space-y-2">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
              Rattachement parental
            </h2>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">
                  Fiche parents
                </label>
                {parentData && (
                  <button
                    type="button"
                    onClick={handleOpenParentModal}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition-colors"
                    title="Ouvrir la fiche parent"
                  >
                    <ExternalLink size={12} />
                    Voir / Modifier
                  </button>
                )}
              </div>
              <select
                value={form.parent_id}
                onChange={e => {
                  set('parent_id', e.target.value)
                  setTutorSource('tutor1')
                }}
                className="input"
              >
                <option value="">— Aucun rattachement —</option>
                {parents.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.tutor1_last_name} {p.tutor1_first_name}
                    {p.tutor2_last_name ? ` / ${p.tutor2_last_name} ${p.tutor2_first_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Sections conditionnelles (parent sélectionné + actif) ── */}
          {parentData && (
            <>
              {/* Sélecteur source tuteur */}
              <div className="card p-3">
                <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">
                  Reprendre les informations du
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className={clsx(
                    'flex items-center gap-2.5 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors',
                    tutorSource === 'tutor1'
                      ? 'border-primary-300 bg-primary-50'
                      : 'border-warm-200 hover:bg-warm-50'
                  )}>
                    <input
                      type="radio"
                      name="tutorSource"
                      value="tutor1"
                      checked={tutorSource === 'tutor1'}
                      onChange={() => setTutorSource('tutor1')}
                      className="accent-amber-500 flex-shrink-0"
                    />
                    <span className="text-sm text-secondary-700">
                      <span className="font-medium">{relLabel(parentData.tutor1_relationship, 'Tuteur 1')}</span>
                      {' '}— {parentData.tutor1_last_name} {parentData.tutor1_first_name}
                    </span>
                  </label>

                  {hasTutor2 && (
                    <label className={clsx(
                      'flex items-center gap-2.5 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors',
                      tutorSource === 'tutor2'
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-warm-200 hover:bg-warm-50'
                    )}>
                      <input
                        type="radio"
                        name="tutorSource"
                        value="tutor2"
                        checked={tutorSource === 'tutor2'}
                        onChange={() => setTutorSource('tutor2')}
                        className="accent-amber-500 flex-shrink-0"
                      />
                      <span className="text-sm text-secondary-700">
                        <span className="font-medium">{relLabel(parentData.tutor2_relationship, 'Tuteur 2')}</span>
                        {' '}— {parentData.tutor2_last_name} {parentData.tutor2_first_name}
                      </span>
                    </label>
                  )}
                </div>
              </div>

              {/* Frères / Sœurs */}
              <div className="card p-3 space-y-1.5 flex-1">
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-warm-400" />
                  <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
                    Frères / Sœurs
                  </h2>
                </div>
                {siblings.length === 0 ? (
                  <p className="text-[11px] text-warm-300 italic">Aucun frère ou sœur enregistré.</p>
                ) : (
                  <div className="space-y-1.5">
                    {siblings.map(sib => {
                      const age = Math.floor((Date.now() - new Date(sib.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
                      const enrollment = sib.enrollments?.[0]
                      const cls = enrollment?.classes
                      const mt = mainTeachers.find(t => t.class_id === enrollment?.class_id)
                      const teacherName = mt?.teachers
                        ? `${mt.teachers.civilite ? mt.teachers.civilite + ' ' : ''}${mt.teachers.last_name} ${mt.teachers.first_name}`
                        : null
                      const schedule = cls?.day_of_week
                        ? [cls.day_of_week, cls.start_time && cls.end_time ? `${cls.start_time.slice(0,5)}–${cls.end_time.slice(0,5)}` : null].filter(Boolean).join(' ')
                        : null
                      return (
                        <div key={sib.id} className="bg-warm-50 border border-warm-100 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            {sib.gender === 'male' ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold leading-none">M</span>
                            ) : sib.gender === 'female' ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-pink-100 text-pink-500 text-[10px] font-bold leading-none">F</span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-warm-100 text-warm-400 text-[10px] font-bold leading-none">—</span>
                            )}
                            <Link
                              href={`/dashboard/students/${sib.id}`}
                              className="text-xs font-medium text-primary-600 hover:text-primary-800 hover:underline transition-colors"
                            >
                              {sib.last_name} {sib.first_name}
                            </Link>
                            <span className="text-[11px] text-warm-400">{age} ans</span>
                          </div>
                          {cls?.name && (
                            <p className="text-[11px] text-warm-500 mt-0.5 ml-7">
                              Classe : {cls.name}{schedule ? ` · ${schedule}` : ''}{teacherName ? ` — ${teacherName}` : ''}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}</div>
            </>
          )}

        </div>
      </div>

      {/* ── Autorisations & Suivi particulier ── */}
      <div className="card p-3 space-y-2 max-w-5xl">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
          Autorisations & Suivi particulier
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

          <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-warm-100 hover:bg-warm-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={form.exit_authorization}
              onChange={e => set('exit_authorization', e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500 flex-shrink-0"
            />
            <p className="text-sm font-medium text-secondary-700">Autorisation de sortie</p>
          </label>

          <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-warm-100 hover:bg-warm-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={form.media_authorization}
              onChange={e => set('media_authorization', e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500 flex-shrink-0"
            />
            <p className="text-sm font-medium text-secondary-700">Autorisation média</p>
          </label>

          <label className={clsx(
            'flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors',
            form.has_pai
              ? 'bg-red-50 border-red-200 hover:bg-red-100/70'
              : 'border-warm-100 hover:bg-warm-50'
          )}>
            <input
              type="checkbox"
              checked={form.has_pai}
              onChange={e => set('has_pai', e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500 flex-shrink-0"
            />
            <p className="text-sm font-medium text-secondary-700 flex items-center gap-1.5">
              PAI
              <span
                title="Projet d'Aide Individualisé"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-warm-200 text-warm-500 text-[10px] font-bold cursor-help leading-none"
              >?</span>
            </p>
          </label>

        </div>

      </div>

      {/* ── Notes médicales ── */}
      <div className="card p-3 space-y-2 max-w-5xl">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Notes médicales</h2>
        <textarea
          value={form.medical_notes}
          onChange={e => set('medical_notes', e.target.value)}
          rows={2}
          placeholder="Allergies, traitements en cours, recommandations, aménagements pédagogiques..."
          className="input resize-none w-full"
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 pt-1">
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

      {showParentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop non-cliquable */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">

            {/* En-tête */}
            <div className="px-6 py-4 border-b border-warm-100 flex-shrink-0 flex items-start justify-between gap-4">
              <h2 className="text-base font-bold text-secondary-800">
                Fiche parents{' '}
                <span className="text-secondary-600">
                  {fullParent
                    ? `${fullParent.tutor1_last_name} ${fullParent.tutor1_first_name}${fullParent.tutor2_last_name ? ` · ${fullParent.tutor2_last_name} ${fullParent.tutor2_first_name}` : ''}`
                    : `${parentData?.tutor1_last_name} ${parentData?.tutor1_first_name}`
                  }
                </span>
              </h2>
              <button
                onClick={handleCloseParentModal}
                className="flex-shrink-0 p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              {loadingParent ? (
                <div className="flex items-center justify-center py-16 gap-3 text-warm-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Chargement de la fiche…</span>
                </div>
              ) : fullParent ? (
                <ParentForm parent={fullParent} onClose={handleCloseParentModal} />
              ) : (
                <p className="text-sm text-red-500 py-8 text-center">
                  Impossible de charger la fiche parent.
                </p>
              )}
            </div>

          </div>
        </div>
      )}

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

function InfoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-warm-50 border border-warm-100 rounded-lg px-3 py-2.5 text-sm text-secondary-700 space-y-0.5">
      {children}
    </div>
  )
}

// ─── PhotoField ───────────────────────────────────────────────────────────────

interface PhotoFieldProps {
  photoUrl: string | null
  studentId: string | null
  etablissementId: string
  onChange: (url: string | null) => void
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload  = () => resolve()
    image.onerror = reject
    image.src     = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width  = 300
  canvas.height = 400
  canvas.getContext('2d')!.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, 300, 400
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas vide')),
      'image/jpeg',
      0.85
    )
  })
}

function PhotoField({ photoUrl, studentId, etablissementId, onChange }: PhotoFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const streamRef    = useRef<MediaStream | null>(null)
  const photoId      = useRef<string>(studentId ?? crypto.randomUUID())

  const [cropSrc,            setCropSrc]            = useState<string | null>(null)
  const [crop,               setCrop]               = useState({ x: 0, y: 0 })
  const [zoom,               setZoom]               = useState(1)
  const [croppedAreaPixels,  setCroppedAreaPixels]  = useState<Area | null>(null)
  const [showWebcam,         setShowWebcam]         = useState(false)
  const [isUploading,        setIsUploading]        = useState(false)
  const [uploadError,        setUploadError]        = useState<string | null>(null)
  const [confirmDelete,      setConfirmDelete]      = useState(false)

  useEffect(() => {
    if (studentId) photoId.current = studentId
  }, [studentId])

  useEffect(() => {
    if (showWebcam && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play()
    }
  }, [showWebcam])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    e.target.value = ''
  }

  const startWebcam = async () => {
    setUploadError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      setShowWebcam(true)
    } catch {
      setUploadError("Impossible d'accéder à la caméra.")
    }
  }

  const captureWebcam = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg')
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setShowWebcam(false)
    setCropSrc(dataUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const closeWebcam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setShowWebcam(false)
  }

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return
    setUploadError(null)
    setIsUploading(true)
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      if (blob.size > 1_048_576) {
        setUploadError('Photo trop grande après compression (> 1 Mo). Essayez une autre image.')
        return
      }
      const supabase = createClient()
      const path = `${etablissementId}/${photoId.current}.jpg`
      const { error } = await supabase.storage
        .from('student-photos')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('student-photos').getPublicUrl(path)
      onChange(`${publicUrl}?t=${Date.now()}`)
      setCropSrc(null)
    } catch (err: any) {
      setUploadError(err?.message ?? "Erreur lors de l'upload. Veuillez réessayer.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    setUploadError(null)
    setIsUploading(true)
    try {
      const supabase = createClient()
      const path = `${etablissementId}/${photoId.current}.jpg`
      await supabase.storage.from('student-photos').remove([path])
      onChange(null)
    } catch {
      setUploadError('Erreur lors de la suppression.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide self-start">Photo</span>
        {/* Vignette 3:4 */}
        <div className="w-[78px] h-[104px] rounded-lg overflow-hidden border border-warm-200 bg-warm-100 flex items-center justify-center flex-shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt="Photo élève" className="w-full h-full object-cover" />
          ) : (
            <User size={32} className="text-warm-300" />
          )}
        </div>

        {/* Boutons */}
        <div className="flex flex-col gap-1 items-start">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition-colors disabled:opacity-40"
          >
            <Upload size={11} />
            Importer
          </button>
          <button
            type="button"
            onClick={startWebcam}
            disabled={isUploading}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 transition-colors disabled:opacity-40"
          >
            <Camera size={11} />
            Webcam
          </button>
          {photoUrl && !confirmDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isUploading}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
            >
              <Trash2 size={11} />
              Supprimer
            </button>
          )}
          {confirmDelete && (
            <div className="flex flex-col gap-1 items-start">
              <button
                type="button"
                onClick={() => { setConfirmDelete(false); handleDelete() }}
                disabled={isUploading}
                className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors disabled:opacity-40"
              >
                Confirmer ?
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-warm-400 hover:text-warm-600 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {uploadError && (
          <p className="text-[10px] text-red-500 text-center leading-tight max-w-[90px] break-words">
            {uploadError}
          </p>
        )}
      </div>

      {/* Input fichier masqué */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Modale recadrage */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-secondary-800">Recadrer la photo</h3>
              <button
                type="button"
                onClick={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
                className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="relative w-full" style={{ height: 320 }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={3 / 4}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { URL.revokeObjectURL(cropSrc); setCropSrc(null) }}
                  className="btn btn-secondary text-sm py-1.5 px-3"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleCropConfirm}
                  disabled={isUploading}
                  className="btn btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
                >
                  {isUploading ? 'Envoi…' : 'Valider'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale webcam */}
      {showWebcam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-secondary-800">Capture webcam</h3>
              <button
                type="button"
                onClick={closeWebcam}
                className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col items-center gap-3">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-lg bg-black"
                style={{ maxHeight: 280 }}
              />
              <button
                type="button"
                onClick={captureWebcam}
                className="btn btn-primary flex items-center gap-2"
              >
                <Camera size={15} />
                Capturer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
