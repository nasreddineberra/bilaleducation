'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { BookOpenText, ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import RichTextEditor from '@/components/ui/RichTextEditor'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'

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
  const toast  = useToast()
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

  const isStaff = ['direction', 'responsable_pedagogique'].includes(role)

  // Matieres disponibles selon la classe sélectionnée et le rôle
  const availableSubjects = useMemo(() => {
    if (!classId) return []

    if (isStaff) {
      const subjects = allAssignments
        .filter(a => a.class_id === classId && a.subject)
        .map(a => a.subject!)
      return [...new Set(subjects)].sort()
    }

    const myAssignmentsForClass = teacherAssignments.filter(a => a.class_id === classId)
    const isMain = myAssignmentsForClass.some(a => a.is_main_teacher)

    if (isMain) {
      const subjects = allAssignments
        .filter(a => a.class_id === classId && a.subject)
        .map(a => a.subject!)
      return [...new Set(subjects)].sort()
    }

    return myAssignmentsForClass
      .filter(a => a.subject)
      .map(a => a.subject!)
  }, [classId, teacherAssignments, allAssignments, isStaff])

  const isMainForClass = useMemo(() => {
    if (isStaff) return true
    return teacherAssignments.some(a => a.class_id === classId && a.is_main_teacher)
  }, [classId, teacherAssignments, isStaff])

  const availableTeachers = useMemo(() => {
    if (!isStaff || !classId) return []
    const teacherIds = [...new Set(allAssignments.filter(a => a.class_id === classId).map(a => a.teacher_id))]
    return allTeachers.filter(t => teacherIds.includes(t.id))
  }, [classId, allAssignments, allTeachers, isStaff])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!classId || !title.trim() || !contentHtml.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires.')
      return
    }

    if (showHomework && (!hwTitle.trim() || !hwDueDate)) {
      toast.error('Veuillez remplir le titre et la date de rendu du devoir.')
      return
    }

    setSaving(true)
    const supabase = createClient()

    try {
      const effectiveTeacherId = isStaff ? selectedTeacherId : teacherId
      if (!effectiveTeacherId) {
        toast.error('Enseignant non identifie.')
        setSaving(false)
        return
      }

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

        if (hw) {
          fetch('/api/notifications/homework', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ homework_id: hw.id, etablissement_id: etablissementId }),
          }).catch(() => {})
        }
      }

      router.push('/dashboard/cahier-texte')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'enregistrement.')
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

      {/* Séance */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Seance</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Classe */}
          <FloatSelect
            label="Classe"
            required
            value={classId}
            onChange={e => { setClassId(e.target.value); setSubject(''); setSelectedTeacherId(teacherId ?? '') }}
          >
            <option value=""></option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FloatSelect>

          {/* Matière */}
          {availableSubjects.length === 0 && !isMainForClass ? (
            <FloatInput
              label="Matiere"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          ) : (
            <FloatSelect
              label="Matiere"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            >
              <option value=""></option>
              {isMainForClass && <option value="">General (toutes matieres)</option>}
              {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </FloatSelect>
          )}

          {/* Enseignant (staff uniquement) */}
          {isStaff && (
            <FloatSelect
              label="Enseignant"
              required
              value={selectedTeacherId}
              onChange={e => setSelectedTeacherId(e.target.value)}
            >
              <option value=""></option>
              {availableTeachers.map(t => (
                <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>
              ))}
            </FloatSelect>
          )}

          {/* Date */}
          <FloatInput
            label="Date de seance"
            required
            type="date"
            value={sessionDate}
            onChange={e => setSessionDate(e.target.value)}
          />
        </div>

        {/* Titre */}
        <FloatInput
          label="Titre de la seance"
          required
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex : Les fractions - Introduction"
        />

        {/* Contenu riche */}
        <div>
          <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Contenu de la seance <span className="text-red-400">*</span>
          </label>
          <div className="mt-1">
            <RichTextEditor
              content={contentHtml}
              onChange={setContentHtml}
              placeholder="Decrivez ce qui a ete fait en classe..."
            />
          </div>
        </div>
      </div>

      {/* Devoirs */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-secondary-700 uppercase tracking-wide">Devoir</h2>
          {!showHomework ? (
            <FloatButton
              variant="secondary"
              type="button"
              onClick={() => setShowHomework(true)}
            >
              <Plus size={14} /> Ajouter un devoir
            </FloatButton>
          ) : (
            <FloatButton
              variant="danger"
              type="button"
              onClick={() => { setShowHomework(false); setHwTitle(''); setHwDescription(''); setHwDueDate('') }}
            >
              <Trash2 size={14} /> Retirer
            </FloatButton>
          )}
        </div>

        {showHomework && (
          <div className="space-y-4 border-t border-warm-200 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FloatInput
                label="Titre du devoir"
                required
                value={hwTitle}
                onChange={e => setHwTitle(e.target.value)}
                placeholder="Ex : Exercices page 45"
              />
              <FloatSelect
                label="Type"
                required
                value={hwType}
                onChange={e => setHwType(e.target.value)}
              >
                <option value="exercice">Exercice</option>
                <option value="lecon">Lecon a apprendre</option>
                <option value="expose">Expose</option>
                <option value="autre">Autre</option>
              </FloatSelect>
              <FloatInput
                label="Date de rendu"
                required
                type="date"
                value={hwDueDate}
                onChange={e => setHwDueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Consignes</label>
              <div className="mt-1">
                <RichTextEditor
                  content={hwDescription}
                  onChange={setHwDescription}
                  placeholder="Instructions pour le devoir..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton variant="secondary" type="button" onClick={() => router.push('/dashboard/cahier-texte')}>
          Annuler
        </FloatButton>
        <FloatButton variant={isEdit ? 'edit' : 'submit'} type="submit" loading={saving}>
          {isEdit ? 'Modifier' : 'Valider'}
        </FloatButton>
      </div>
    </form>
  )
}
