'use client'

import { useState, useMemo, useRef } from 'react'
import { clsx } from 'clsx'
import { Send, Paperclip, X, Eye, CheckSquare, Square, Bell, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import RichTextEditor from '@/components/ui/RichTextEditor'
import type { UserRole } from '@/types/database'
import { FloatInput, FloatButton, SearchField } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffMember = {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
}

type Channel = 'email' | 'notification' | 'both'

interface Props {
  role: string
  senderEmail: string
  senderName: string
  staffMembers: StaffMember[]
  directionEmails: string[]
  etablissementId: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  direction: 'Direction',
  responsable_pedagogique: 'Resp. pedagogique',
  enseignant: 'Enseignant',
  secretaire: 'Secretaire',
  comptable: 'Comptable',
}

// Roles qu'un enseignant peut contacter
const ENSEIGNANT_ALLOWED_ROLES = ['direction', 'secretaire', 'comptable', 'responsable_pedagogique']

// ─── Component ───────────────────────────────────────────────────────────────

export default function StaffMessageClient({
  role, senderEmail, senderName, staffMembers, directionEmails, etablissementId,
}: Props) {
  const toast = useToast()
  const [channel, setChannel] = useState<Channel>('email')
  const [selectAll, setSelectAll] = useState(false)
  const [selectGroup, setSelectGroup] = useState<'staff' | 'enseignants' | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEnseignant = role === 'enseignant'

  // Staff disponible pour l'enseignant
  const availableStaff = useMemo(() => {
    if (isEnseignant) {
      return staffMembers.filter(s => ENSEIGNANT_ALLOWED_ROLES.includes(s.role))
    }
    return staffMembers
  }, [staffMembers, isEnseignant])

  // Roles disponibles
  const availableRoles = useMemo(() => {
    const roles = [...new Set(availableStaff.map(s => s.role))]
    return roles.sort()
  }, [availableStaff])

  // Membres filtres
  const filteredStaff = useMemo(() => {
    let list = availableStaff
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase()
      list = list.filter(s => `${s.last_name} ${s.first_name} ${s.email}`.toLowerCase().includes(q))
    }
    return list
  }, [availableStaff, staffSearch])

  // Destinataires resolus
  const resolvedRecipients = useMemo(() => {
    if (selectAll) return availableStaff
    if (selectGroup === 'staff') return availableStaff.filter(s => s.role !== 'enseignant')
    if (selectGroup === 'enseignants') return availableStaff.filter(s => s.role === 'enseignant')
    const byRole = availableStaff.filter(s => selectedRoles.has(s.role))
    const byId = availableStaff.filter(s => selectedIds.has(s.id))
    const map = new Map<string, StaffMember>()
    byRole.forEach(s => map.set(s.id, s))
    byId.forEach(s => map.set(s.id, s))
    return [...map.values()]
  }, [selectAll, selectGroup, selectedRoles, selectedIds, availableStaff])

  const recipientEmails = resolvedRecipients.map(s => s.email)

  const recipientSummary = recipientEmails.length > 0
    ? recipientEmails.join(', ')
    : 'Aucun destinataire selectionne'

  const canSend = subject.trim() && bodyHtml.trim() && resolvedRecipients.length > 0

  const toggleRole = (r: string) => {
    setSelectedRoles(prev => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
    setSelectAll(false)
    setSelectGroup(null)
  }

  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setSelectAll(false)
    setSelectGroup(null)
  }

  const handleSelectAll = () => {
    setSelectAll(!selectAll)
    setSelectGroup(null)
    setSelectedRoles(new Set())
    setSelectedIds(new Set())
  }

  const handleSelectGroup = (g: 'staff' | 'enseignants') => {
    setSelectGroup(prev => prev === g ? null : g)
    setSelectAll(false)
    setSelectedRoles(new Set())
    setSelectedIds(new Set())
  }

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)])
    e.target.value = ''
  }

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx))

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)

    try {
      const supabase = createClient()

      // Upload PJ
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

      // Creer le message
      const { data: announcement, error: annErr } = await supabase
        .from('announcements')
        .insert({
          etablissement_id: etablissementId,
          title: subject,
          content: bodyHtml,
          body_html: bodyHtml,
          announcement_type: 'staff',
          channel,
          sender_email: senderEmail,
          published_by: (await supabase.auth.getUser()).data.user?.id,
          is_published: true,
          published_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
          recipient_count: resolvedRecipients.length,
        })
        .select('id')
        .single()

      if (annErr) throw new Error(annErr.message)

      // PJ
      if (attachmentUrls.length > 0) {
        await supabase.from('announcement_attachments').insert(
          attachmentUrls.map(a => ({ announcement_id: announcement.id, ...a }))
        )
      }

      // Destinataires staff
      await supabase.from('announcement_staff_recipients').insert(
        resolvedRecipients.map(s => ({
          announcement_id: announcement.id,
          profile_id: s.id,
          email: s.email,
          email_status: 'pending',
        }))
      )

      toast.success('Message enregistré avec succès.')
      setSubject('')
      setBodyHtml('')
      setAttachments([])
      setSelectAll(false)
      setSelectedRoles(new Set())
      setSelectedIds(new Set())
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'envoi')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 1. Canal */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Canal d'envoi</h2>
        <div className="flex gap-2">
          {([
            { value: 'email' as Channel, label: 'Email', icon: Mail },
            { value: 'notification' as Channel, label: 'Notification app', icon: Bell },
            { value: 'both' as Channel, label: 'Les deux', icon: Send },
          ]).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setChannel(value)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                channel === value ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
              )}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Destinataires */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Destinataires</h2>

        {/* Selection par role */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              selectAll ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
            )}
          >
            Tous
          </button>
          <button
            type="button"
            onClick={() => handleSelectGroup('staff')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              selectGroup === 'staff' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
            )}
          >
            Staff
          </button>
          <button
            type="button"
            onClick={() => handleSelectGroup('enseignants')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              selectGroup === 'enseignants' ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
            )}
          >
            Enseignants
          </button>
          {availableRoles.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRole(r)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                selectedRoles.has(r) ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
              )}
            >
              {ROLE_LABELS[r] ?? r}
            </button>
          ))}
        </div>

        {/* Selection individuelle */}
        <div className="space-y-2">
          <SearchField
            value={staffSearch}
            onChange={setStaffSearch}
            placeholder="Rechercher un membre…"
            className="max-w-sm"
          />

          <div className="max-h-48 overflow-y-auto border border-warm-100 rounded-lg divide-y divide-warm-50">
            {filteredStaff.map(s => {
              const isSelected = selectAll || selectedRoles.has(s.role) || selectedIds.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleMember(s.id)}
                  className={clsx(
                    'flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs transition-colors',
                    isSelected ? 'bg-primary-50' : 'hover:bg-warm-50',
                  )}
                >
                  {isSelected
                    ? <CheckSquare size={14} className="text-primary-600 flex-shrink-0" />
                    : <Square size={14} className="text-warm-300 flex-shrink-0" />
                  }
                  <span className={clsx('font-medium', isSelected ? 'text-primary-700' : 'text-warm-700')}>
                    {s.last_name} {s.first_name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-warm-100 text-warm-500 font-medium">
                    {ROLE_LABELS[s.role] ?? s.role}
                  </span>
                  <span className="text-warm-400 ml-auto truncate max-w-[200px]">{s.email}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Recap */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-warm-500">Recapitulatif ({resolvedRecipients.length} destinataire(s) en CCI)</label>
          <textarea
            readOnly
            value={recipientSummary}
            rows={2}
            className="input text-xs w-full bg-warm-50 text-warm-600 resize-none"
          />
        </div>
      </div>

      {/* 3. Objet */}
      <div className="card p-4">
        <FloatInput
          label="Objet"
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>

      {/* 4. Corps */}
      <div className="card p-4 space-y-2">
        <label className="text-xs font-bold text-warm-500 uppercase tracking-widest">Message</label>
        <RichTextEditor content={bodyHtml} onChange={setBodyHtml} />
      </div>

      {/* 5. PJ */}
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
          <input ref={fileInputRef} type="file" multiple onChange={handleFileAdd} className="hidden" />
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

      {/* 6. Actions */}
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

      {showPreview && bodyHtml && (
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Apercu du message</h2>
            <FloatButton variant="secondary" type="button" onClick={() => setShowPreview(false)} className="!px-2">
              <X size={14} />
            </FloatButton>
          </div>
          <div className="border border-warm-100 rounded-lg p-4 bg-white">
            <p className="text-sm font-medium text-warm-700 mb-2">Objet : {subject || '(sans objet)'}</p>
            <hr className="my-2 border-warm-100" />
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </div>
        </div>
      )}
    </div>
  )
}
