'use client'

import { useState, useMemo, useRef } from 'react'
import { clsx } from 'clsx'
import { Send, Paperclip, X, Eye, CheckSquare, Square } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import RichTextEditor from '@/components/ui/RichTextEditor'
import type { UserRole } from '@/types/database'
import { FloatInput, FloatSelect, FloatButton, SearchField } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string; name: string; level: string
  day_of_week: string | null; start_time: string | null; end_time: string | null
  main_teacher_name: string | null; main_teacher_civilite: string | null
  cotisation_label: string | null
}

type ParentRow = {
  id: string
  tutor1_last_name: string; tutor1_first_name: string; tutor1_email: string | null
  tutor2_last_name: string | null; tutor2_first_name: string | null; tutor2_email: string | null
}

type TargetType = 'all_active' | 'all_registered' | 'class' | 'selected'

interface Props {
  role: string
  senderEmail: string
  senderName: string
  classes: ClassRow[]
  parents: ParentRow[]
  classParentMap: Record<string, string[]>
  directionEmails: string[]
  etablissementId: string
  schoolYearId: string | null
  yearLabel: string | null
}

// ─── Permissions par rôle ────────────────────────────────────────────────────

const TARGET_PERMISSIONS: Record<TargetType, UserRole[]> = {
  all_active:     ['admin', 'direction', 'secretaire', 'responsable_pedagogique'],
  all_registered: ['admin', 'direction', 'secretaire'],
  class:          ['admin', 'direction', 'responsable_pedagogique', 'comptable', 'secretaire', 'enseignant'],
  selected:       ['admin', 'direction', 'responsable_pedagogique', 'comptable', 'secretaire', 'enseignant'],
}

const TARGET_LABELS: Record<TargetType, string> = {
  all_active:     'Tous les parents (eleves actifs)',
  all_registered: 'Tous les parents enregistres',
  class:          'Parents d\'une classe',
  selected:       'Parents choisis',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getParentEmails(parent: ParentRow): string[] {
  const emails: string[] = []
  if (parent.tutor1_email) emails.push(parent.tutor1_email)
  if (parent.tutor2_email) emails.push(parent.tutor2_email)
  return emails
}

function getParentLabel(parent: ParentRow): string {
  let label = `${parent.tutor1_last_name} ${parent.tutor1_first_name}`
  if (parent.tutor2_last_name) {
    label += ` / ${parent.tutor2_last_name} ${parent.tutor2_first_name}`
  }
  return label
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewMessageClient({
  role, senderEmail, senderName, classes, parents, classParentMap, directionEmails, etablissementId, schoolYearId, yearLabel,
}: Props) {
  const toast = useToast()
  const [targetType, setTargetType] = useState<TargetType | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [selectedParentIds, setSelectedParentIds] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [parentSearch, setParentSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const targetTypes: TargetType[] = ['all_active', 'all_registered', 'class', 'selected']

  // Parents filtrés pour la recherche
  const filteredParents = useMemo(() => {
    if (!parentSearch.trim()) return parents
    const q = parentSearch.toLowerCase()
    return parents.filter(p =>
      `${p.tutor1_last_name} ${p.tutor1_first_name} ${p.tutor2_last_name ?? ''} ${p.tutor2_first_name ?? ''}`.toLowerCase().includes(q)
    )
  }, [parents, parentSearch])

  // Calcul des emails destinataires
  const recipientEmails = useMemo(() => {
    const emails = new Set<string>()

    if (targetType === 'all_active' || targetType === 'all_registered') {
      // all_active : parents ayant un eleve inscrit dans une classe de l'annee
      // all_registered : tous les parents
      const activeParentIds = targetType === 'all_active'
        ? new Set(Object.values(classParentMap).flat())
        : null

      parents
        .filter(p => !activeParentIds || activeParentIds.has(p.id))
        .forEach(p => getParentEmails(p).forEach(e => emails.add(e)))
    } else if (targetType === 'class' && selectedClassId) {
      const parentIds = new Set(classParentMap[selectedClassId] ?? [])
      parents
        .filter(p => parentIds.has(p.id))
        .forEach(p => getParentEmails(p).forEach(e => emails.add(e)))
    } else if (targetType === 'selected') {
      parents
        .filter(p => selectedParentIds.has(p.id))
        .forEach(p => getParentEmails(p).forEach(e => emails.add(e)))
    }

    return [...emails]
  }, [targetType, selectedClassId, parents, selectedParentIds, classParentMap])

  // Resume des destinataires
  const recipientSummary = useMemo(() => {
    if (!targetType) return ''
    if (recipientEmails.length === 0) return 'Aucun destinataire'
    return recipientEmails.join(', ')
  }, [targetType, recipientEmails])

  const canSend = subject.trim() && bodyHtml.trim() && targetType && (
    targetType === 'all_active' ||
    targetType === 'all_registered' ||
    (targetType === 'class' && selectedClassId) ||
    (targetType === 'selected' && selectedParentIds.size > 0)
  )

  // Toggle parent selection
  const toggleParent = (id: string) => {
    setSelectedParentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedParentIds(prev => {
      const next = new Set(prev)
      filteredParents.forEach(p => next.add(p.id))
      return next
    })
  }

  const deselectAllFiltered = () => {
    setSelectedParentIds(prev => {
      const next = new Set(prev)
      filteredParents.forEach(p => next.delete(p.id))
      return next
    })
  }

  // Ajout de pieces jointes
  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)])
    }
    e.target.value = ''
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  // Envoi
  const handleSend = async () => {
    if (!canSend) return
    setSending(true)

    try {
      const supabase = createClient()

      // 1. Upload des pieces jointes
      const attachmentUrls: { file_url: string; file_name: string; file_size: number }[] = []
      for (const file of attachments) {
        const ext = file.name.split('.').pop()
        const path = `communications/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('communication-attachments')
          .upload(path, file)
        if (uploadErr) throw new Error(`Erreur upload ${file.name}: ${uploadErr.message}`)
        const { data: urlData } = supabase.storage.from('communication-attachments').getPublicUrl(path)
        attachmentUrls.push({ file_url: urlData.publicUrl, file_name: file.name, file_size: file.size })
      }

      // 2. Creer l'annonce
      const { data: announcement, error: annErr } = await supabase
        .from('announcements')
        .insert({
          etablissement_id: etablissementId,
          title: subject,
          content: bodyHtml,
          body_html: bodyHtml,
          announcement_type: targetType,
          target_class_id: targetType === 'class' ? selectedClassId : null,
          channel: 'email',
          sender_email: senderEmail,
          published_by: (await supabase.auth.getUser()).data.user?.id,
          is_published: true,
          published_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (annErr) throw new Error(annErr.message)

      // 3. Sauvegarder les pieces jointes
      if (attachmentUrls.length > 0) {
        await supabase.from('announcement_attachments').insert(
          attachmentUrls.map(a => ({ announcement_id: announcement.id, ...a }))
        )
      }

      // 4. Resoudre les destinataires et inserer
      let resolvedParentIds: string[] = []

      if (targetType === 'selected') {
        resolvedParentIds = [...selectedParentIds]
      } else if (targetType === 'class' && selectedClassId) {
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('students(parent_id)')
          .eq('class_id', selectedClassId)
          .eq('status', 'active')
        resolvedParentIds = [...new Set(
          ((enrollments ?? []) as any[]).map(e => e.students?.parent_id).filter(Boolean)
        )]
      } else if (targetType === 'all_active' && schoolYearId) {
        // Tous les parents d'eleves actifs cette annee
        const { data: activeClasses } = await supabase
          .from('classes')
          .select('id')
          .eq('academic_year', yearLabel ?? '')
        const classIds = (activeClasses ?? []).map(c => c.id)
        if (classIds.length > 0) {
          const { data: enrollments } = await supabase
            .from('enrollments')
            .select('students(parent_id)')
            .in('class_id', classIds)
            .eq('status', 'active')
          resolvedParentIds = [...new Set(
            ((enrollments ?? []) as any[]).map(e => e.students?.parent_id).filter(Boolean)
          )]
        }
      } else if (targetType === 'all_registered') {
        resolvedParentIds = parents.map(p => p.id)
      }

      if (resolvedParentIds.length > 0) {
        // Recuperer emails des parents resolus
        const { data: resolvedParents } = await supabase
          .from('parents')
          .select('id, tutor1_email, tutor2_email')
          .in('id', resolvedParentIds)

        const recipients = (resolvedParents ?? []).map(p => ({
          announcement_id: announcement.id,
          parent_id: p.id,
          email: [p.tutor1_email, p.tutor2_email].filter(Boolean).join(', '),
          email_status: 'pending' as const,
        }))

        if (recipients.length > 0) {
          await supabase.from('announcement_recipients').insert(recipients)
        }

        // Mettre a jour le count
        await supabase
          .from('announcements')
          .update({ recipient_count: recipients.length })
          .eq('id', announcement.id)
      }

      // Notifications parents (fire-and-forget)
      if (announcement?.id) {
        fetch('/api/notifications/announcement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ announcement_id: announcement.id, etablissement_id: etablissementId }),
        }).catch(() => {})
      }

      toast.success("Message enregistré avec succès. L'envoi des emails est en cours.")
      // Reset form
      setSubject('')
      setBodyHtml('')
      setAttachments([])
      setTargetType(null)
      setSelectedClassId(null)
      setSelectedParentIds(new Set())
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Destinataires */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Destinataires</h2>

        <div className="flex flex-wrap gap-2">
          {targetTypes.map(tt => {
            const allowed = TARGET_PERMISSIONS[tt].includes(role as UserRole)
            const active = targetType === tt
            return (
              <button
                key={tt}
                type="button"
                disabled={!allowed}
                onClick={() => {
                  setTargetType(active ? null : tt)
                  setSelectedClassId(null)
                  setSelectedParentIds(new Set())
                }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  !allowed && 'opacity-40 cursor-not-allowed border-warm-200 text-warm-400 bg-warm-50',
                  allowed && !active && 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
                  allowed && active && 'border-primary-300 bg-primary-50 text-primary-700',
                )}
              >
                {TARGET_LABELS[tt]}
              </button>
            )
          })}
        </div>

        {/* Selecteur de classe */}
        {targetType === 'class' && (() => {
          const cls = classes.find(c => c.id === selectedClassId)
          const teacherLabel = cls?.main_teacher_name
            ? [cls.main_teacher_civilite, cls.main_teacher_name].filter(Boolean).join(' ')
            : null
          const schedule = cls?.day_of_week
            ? [cls.day_of_week, cls.start_time && cls.end_time ? `${cls.start_time.slice(0, 5)}-${cls.end_time.slice(0, 5)}` : null].filter(Boolean).join(' ')
            : null
          return (
            <div className="flex items-center gap-3 flex-wrap">
              <FloatSelect
                label="Classe"
                value={selectedClassId ?? ''}
                onChange={e => setSelectedClassId(e.target.value || null)}
                wrapperClassName="w-fit"
              >
                <option value=""></option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </FloatSelect>
              {cls && (
                <span className="text-xs text-warm-500">
                  {[teacherLabel, cls.cotisation_label, cls.level ? `Niveau ${cls.level}` : null, schedule].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
          )
        })()}

        {/* Selection de parents */}
        {targetType === 'selected' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <SearchField
                value={parentSearch}
                onChange={setParentSearch}
                placeholder="Rechercher un parent…"
                className="max-w-sm"
              />
              <button type="button" onClick={selectAllFiltered} className="text-xs text-primary-600 hover:underline">
                Tout selectionner
              </button>
              <button type="button" onClick={deselectAllFiltered} className="text-xs text-warm-500 hover:underline">
                Tout deselectionner
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto border border-warm-100 rounded-lg divide-y divide-warm-50">
              {filteredParents.map(p => {
                const selected = selectedParentIds.has(p.id)
                const emails = getParentEmails(p)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleParent(p.id)}
                    className={clsx(
                      'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs transition-colors',
                      selected ? 'bg-primary-50' : 'hover:bg-warm-50'
                    )}
                  >
                    {selected ? <CheckSquare size={14} className="text-primary-600 flex-shrink-0" /> : <Square size={14} className="text-warm-300 flex-shrink-0" />}
                    <span className={clsx('font-medium', selected ? 'text-primary-700' : 'text-warm-700')}>
                      {getParentLabel(p)}
                    </span>
                    {emails.length > 0 && (
                      <span className="text-warm-400 ml-auto truncate max-w-[200px]">{emails.join(', ')}</span>
                    )}
                    {emails.length === 0 && (
                      <span className="text-red-400 ml-auto">Pas d'email</span>
                    )}
                  </button>
                )
              })}
              {filteredParents.length === 0 && (
                <p className="text-xs text-warm-400 italic px-3 py-2">Aucun parent trouve.</p>
              )}
            </div>

            <p className="text-xs text-warm-500">{selectedParentIds.size} parent(s) selectionne(s)</p>
          </div>
        )}

        {/* Recap emails */}
        {targetType && recipientSummary && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-warm-500">Recapitulatif des destinataires (CCI)</label>
            <textarea
              readOnly
              value={recipientSummary}
              rows={2}
              className="input text-xs w-full bg-warm-50 text-warm-600 resize-none"
            />
            <p className="text-xs text-warm-400">{recipientEmails.length} email(s) destinataire(s) — Direction en CCI</p>
          </div>
        )}
      </div>

      {/* 2. Objet */}
      <div className="card p-4">
        <FloatInput
          label="Objet"
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>

      {/* 3. Corps du message */}
      <div className="card p-4 space-y-2">
        <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Message</label>
        <RichTextEditor content={bodyHtml} onChange={setBodyHtml} />
      </div>

      {/* 4. Pieces jointes */}
      <div className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Pieces jointes</label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium"
          >
            <Paperclip size={12} /> Ajouter un document
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileAdd}
            className="hidden"
          />
        </div>

        {attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                <Paperclip size={12} className="text-warm-400" />
                <span className="text-warm-700 flex-1 truncate">{file.name}</span>
                <span className="text-warm-400">{(file.size / 1024).toFixed(0)} Ko</span>
                <button type="button" onClick={() => removeAttachment(idx)} className="text-warm-400 hover:text-red-500">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Actions */}
      <div className="flex items-center gap-3 justify-end">
        <FloatButton
          variant="secondary"
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          disabled={!bodyHtml.trim()}
        >
          <Eye size={14} /> Aperçu
        </FloatButton>
        <FloatButton
          variant="submit"
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          loading={sending}
        >
          <Send size={14} /> Envoyer
        </FloatButton>
      </div>

      {/* Apercu HTML */}
      {showPreview && bodyHtml && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Apercu du message</h2>
            <button type="button" onClick={() => setShowPreview(false)} className="text-warm-400 hover:text-warm-600">
              <X size={14} />
            </button>
          </div>
          <div className="border border-warm-100 rounded-lg p-4 bg-white">
            <p className="text-sm font-medium text-warm-700 mb-2">Objet : {subject || '(sans objet)'}</p>
            <hr className="my-2 border-warm-100" />
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
