'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { BookOpenText, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/ui/RichTextEditor'

interface Props {
  role: string
  classes: { id: string; name: string }[]
  teacherId: string | null
  teacherAssignments: { class_id: string; is_main_teacher: boolean; subject: string | null }[]
  allTeachers: { id: string; first_name: string; last_name: string }[]
  allAssignments: { class_id: string; teacher_id: string; is_main_teacher: boolean; subject: string | null }[]
  etablissementId: string
  initialData?: any
}

export default function CahierTexteForm({
  role, classes, teacherId, teacherAssignments,
  allTeachers, allAssignments, etablissementId, initialData,
}: Props) {
  const router = useRouter()
  const isEdit = !!initialData

  const [classId, setClassId] = useState(initialData?.class_id ?? '')
  const [subject, setSubject] = useState(initialData?.subject ?? '')
  const [selectedTeacherId, setSelectedTeacherId] = useState(initialData?.teacher_id ?? teacherId ?? '')
  const [sessionDate, setSessionDate] = useState(initialData?.session_date ?? new Date().toISOString().slice(0, 10))
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [contentHtml, setContentHtml] = useState(initialData?.content_html ?? '')

  const [showHomework, setShowHomework] = useState(false)
  const [hwTitle, setHwTitle] = useState('')
  const [hwType, setHwType] = useState<string>('exercice')
  const [hwDueDate, setHwDueDate] = useState('')
  const [hwDescription, setHwDescription] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isStaff = ['direction', 'responsable_pedagogique'].includes(role)

  // Matieres disponibles selon la classe sélectionnée et le rôle
  const availableSubjects = useMemo(() => {
    if (!classId) return []

    if (isStaff) {
      // Direction/resp.péda : toutes les matières de la classe
      const subjects = allAssignments
        .filter(a => a.class_id === classId && a.subject)
        .map(a => a.subject!)
      return [...new Set(subjects)].sort()
    }

    // Enseignant
    const myAssignmentsForClass = teacherAssignments.filter(a => a.class_id === classId)
    const isMain = myAssignmentsForClass.some(a => a.is_main_teacher)

    if (isMain) {
      // Prof principal : toutes les matières de cette classe
      const subjects = allAssignments
        .filter(a => a.class_id === classId && a.subject)
        .map(a => a.subject!)
      return [...new Set(subjects)].sort()
    }

    // Prof de matière : uniquement ses matières
    return myAssignmentsForClass
      .filter(a => a.subject)
      .map(a => a.subject!)
  }, [classId, teacherAssignments, allAssignments, isStaff])

  // Auto-set subject si une seule matière
  const isMainForClass = useMemo(() => {
    if (isStaff) return true
    return teacherAssignments.some(a => a.class_id === classId && a.is_main_teacher)
  }, [classId, teacherAssignments, isStaff])

  // Enseignants disponibles pour cette classe (staff)
  const availableTeachers = useMemo(() => {
    if (!isStaff || !classId) return []
    const teacherIds = [...new Set(allAssignments.filter(a => a.class_id === classId).map(a => a.teacher_id))]
    return allTeachers.filter(t => teacherIds.includes(t.id))
  }, [classId, allAssignments, allTeachers, isStaff])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!classId || !title.trim() || !contentHtml.trim()) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }

    if (showHomework && (!hwTitle.trim() || !hwDueDate)) {
      setError('Veuillez remplir le titre et la date de rendu du devoir.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      const effectiveTeacherId = isStaff ? selectedTeacherId : teacherId
      if (!effectiveTeacherId) {
        setError('Enseignant non identifie.')
        setSaving(false)
        return
      }

      // Insert journal entry
      const { data: journal, error: journalErr } = await supabase
        .from('class_journal')
        .insert({
          etablissement_id: etablissementId,
          class_id: classId,
          teacher_id: effectiveTeacherId,
          subject: subject || null,
          session_date: sessionDate,
          title: title.trim(),
          content_html: contentHtml,
        })
        .select('id')
        .single()

      if (journalErr) throw journalErr

      // Insert homework if toggled
      if (showHomework && hwTitle.trim() && hwDueDate) {
        const { data: hw, error: hwErr } = await supabase
          .from('homework')
          .insert({
            etablissement_id: etablissementId,
            class_id: classId,
            teacher_id: effectiveTeacherId,
            subject: subject || 'General',
            journal_entry_id: journal.id,
            title: hwTitle.trim(),
            description_html: hwDescription,
            homework_type: hwType,
            due_date: hwDueDate,
          })
          .select('id')
          .single()

        if (hwErr) throw hwErr

        // Fire-and-forget : notifier les parents
        if (hw) {
          fetch('/api/notifications/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              homework_id: hw.id,
              etablissement_id: etablissementId,
            }),
          }).catch(() => {})
        }
      }

      router.push('/dashboard/cahier-texte')
      router.refresh()
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de l\'enregistrement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/cahier-texte" className="btn btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold text-secondary-800 flex items-center gap-2">
          <BookOpenText size={20} className="text-primary-500" />
          {isEdit ? 'Modifier la seance' : 'Nouvelle seance'}
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Séance */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Seance</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Classe */}
          <div>
            <label className="label">Classe <span className="text-red-400">*</span></label>
            <select
              value={classId}
              onChange={e => { setClassId(e.target.value); setSubject(''); setSelectedTeacherId(teacherId ?? '') }}
              className="input w-full"
              required
            >
              <option value="">Selectionner une classe</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Matière */}
          <div>
            <label className="label">Matiere {isMainForClass ? '' : <span className="text-red-400">*</span>}</label>
            {availableSubjects.length === 0 && !isMainForClass ? (
              <input value={subject} onChange={e => setSubject(e.target.value)} className="input w-full" placeholder="Matiere" />
            ) : (
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="input w-full"
              >
                {isMainForClass && <option value="">General (toutes matieres)</option>}
                {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </div>

          {/* Enseignant (staff uniquement) */}
          {isStaff && (
            <div>
              <label className="label">Enseignant <span className="text-red-400">*</span></label>
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="input w-full"
                required
              >
                <option value="">Selectionner un enseignant</option>
                {availableTeachers.map(t => (
                  <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="label">Date de seance <span className="text-red-400">*</span></label>
            <input
              type="date"
              value={sessionDate}
              onChange={e => setSessionDate(e.target.value)}
              className="input w-full"
              required
            />
          </div>
        </div>

        {/* Titre */}
        <div>
          <label className="label">Titre de la seance <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input w-full"
            placeholder="Ex : Les fractions - Introduction"
            required
          />
        </div>

        {/* Contenu riche */}
        <div>
          <label className="label">Contenu de la seance <span className="text-red-400">*</span></label>
          <RichTextEditor
            content={contentHtml}
            onChange={setContentHtml}
            placeholder="Decrivez ce qui a ete fait en classe..."
          />
        </div>
      </div>

      {/* Devoirs */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Devoir</h2>
          {!showHomework ? (
            <button
              type="button"
              onClick={() => setShowHomework(true)}
              className="btn btn-ghost text-sm flex items-center gap-1 text-primary-600"
            >
              <Plus size={14} /> Ajouter un devoir
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setShowHomework(false); setHwTitle(''); setHwDescription(''); setHwDueDate('') }}
              className="btn btn-ghost text-sm flex items-center gap-1 text-red-500"
            >
              <Trash2 size={14} /> Retirer
            </button>
          )}
        </div>

        {showHomework && (
          <div className="space-y-4 border-t border-warm-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Titre du devoir <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={hwTitle}
                  onChange={e => setHwTitle(e.target.value)}
                  className="input w-full"
                  placeholder="Ex : Exercices page 45"
                />
              </div>
              <div>
                <label className="label">Type <span className="text-red-400">*</span></label>
                <select value={hwType} onChange={e => setHwType(e.target.value)} className="input w-full">
                  <option value="exercice">Exercice</option>
                  <option value="lecon">Lecon a apprendre</option>
                  <option value="expose">Expose</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="label">Date de rendu <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  value={hwDueDate}
                  onChange={e => setHwDueDate(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
            <div>
              <label className="label">Consignes</label>
              <RichTextEditor
                content={hwDescription}
                onChange={setHwDescription}
                placeholder="Instructions pour le devoir..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <Link href="/dashboard/cahier-texte" className="btn btn-ghost">
          Annuler
        </Link>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Enregistrement...' : isEdit ? 'Mettre a jour' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}
