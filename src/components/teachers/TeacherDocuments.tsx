'use client'

import { useState, useRef, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { Eye, Download, Trash2, FileText, Paperclip } from 'lucide-react'
import { FloatSelect, FloatInput, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import type { TeacherDocument } from '@/types/database'

const CATEGORIES = [
  { key: 'contrat',  label: 'Contrat' },
  { key: 'diplome',  label: 'Diplôme' },
  { key: 'identite', label: "Pièce d'identité" },
  { key: 'autre',    label: 'Autre' },
] as const

type Category = typeof CATEGORIES[number]['key']

const MAX_SIZE = 1 * 1024 * 1024 // 1 Mo
const BUCKET = 'teacher-documents'

interface Props {
  teacherId:        string
  etablissementId:  string
  documents:        TeacherDocument[]
  setDocuments:     Dispatch<SetStateAction<TeacherDocument[]>>
}

function formatDate(d: string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function expirationStatus(expiresAt: string | null | undefined): 'ok' | 'soon' | 'expired' | null {
  if (!expiresAt) return null
  const diff = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diff < 0)  return 'expired'
  if (diff < 30) return 'soon'
  return 'ok'
}

export default function TeacherDocuments({ teacherId, etablissementId, documents, setDocuments }: Props) {
  const supabase = createClient()
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)

  const [category, setCategory]   = useState<Category | ''>('')
  const [customLabel, setCustomLabel] = useState('')
  const [file, setFile]           = useState<File | null>(null)
  const [expires, setExpires]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Tri : ordre des catégories (Contrat → Diplôme → Identité → Autre) puis date desc
  const sortedDocs = useMemo(() => {
    const order = new Map<string, number>(CATEGORIES.map((c, i) => [c.key, i]))
    return [...documents].sort((a, b) => {
      const oa = order.get(a.category) ?? 99
      const ob = order.get(b.category) ?? 99
      if (oa !== ob) return oa - ob
      return (b.created_at ?? '').localeCompare(a.created_at ?? '')
    })
  }, [documents])

  // ── Signed URL (bucket privé) ──
  const getSignedUrl = useCallback(async (filePath: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 3600)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }, [supabase])

  const handlePreview = useCallback(async (filePath: string) => {
    const url = await getSignedUrl(filePath)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }, [getSignedUrl])

  const handleDownload = useCallback(async (filePath: string, fileName: string) => {
    const url = await getSignedUrl(filePath)
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.target = '_blank'
    a.click()
  }, [getSignedUrl])

  // ── Upload ──
  const resetForm = () => {
    setCategory(''); setCustomLabel(''); setFile(null); setExpires(''); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleUpload = async () => {
    if (uploadingRef.current) return
    if (!category) { setError('Veuillez choisir une catégorie.'); return }
    if (!customLabel.trim()) { setError('Veuillez renseigner le libellé du document.'); return }
    if (!file)     { setError('Veuillez choisir un fichier.'); return }
    if (file.size > MAX_SIZE) { setError('Le fichier dépasse 1 Mo.'); return }

    uploadingRef.current = true
    setSaving(true); setError(null)
    try {
      const filePath = `${etablissementId}/${teacherId}/${category}/${Date.now()}_${file.name}`

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(filePath, file)
      if (upErr) { setError(upErr.message); return }

      const { data: newDoc, error: insErr } = await supabase
        .from('teacher_documents')
        .insert({
          etablissement_id: etablissementId,
          teacher_id:       teacherId,
          category,
          label:            customLabel.trim() || null,
          file_url:         filePath,
          file_name:        file.name,
          expires_at:       expires || null,
        })
        .select('id, etablissement_id, teacher_id, category, label, file_url, file_name, expires_at, created_at')
        .single()

      if (insErr) { setError(insErr.message); return }
      if (newDoc) setDocuments(prev => [...prev, newDoc as TeacherDocument])
      resetForm()
      router.refresh()
    } finally {
      setSaving(false)
      uploadingRef.current = false
    }
  }

  const handleDelete = async (docId: string) => {
    const doc = documents.find(d => d.id === docId)
    if (doc) await supabase.storage.from(BUCKET).remove([doc.file_url])
    const { error } = await supabase.from('teacher_documents').delete().eq('id', docId)
    if (!error) { setDocuments(prev => prev.filter(d => d.id !== docId)); router.refresh() }
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-4">

      {/* ── Formulaire d'ajout ── */}
      <div className="card p-3 space-y-3 max-w-5xl">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Ajouter un document</h2>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <FloatSelect
              label="Catégorie"
              required
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
            >
              <option value="" disabled hidden></option>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </FloatSelect>
          </div>

          <div className="w-[264px]">
            <FloatInput
              label="Document"
              required
              value={customLabel}
              onChange={e => setCustomLabel(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
            />
          </div>

          <div className="w-40">
            <FloatInput
              label="Expiration (option.)"
              type="date"
              value={expires}
              onChange={e => setExpires(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-secondary-700 bg-warm-100 hover:bg-warm-200 rounded-lg cursor-pointer transition-colors">
            <Paperclip size={13} />
            {file ? <span className="max-w-[160px] truncate">{file.name}</span> : 'Choisir un fichier'}
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={e => { setFile(e.target.files?.[0] ?? null); setError(null) }}
            />
          </label>

          <FloatButton type="button" variant="submit" onClick={handleUpload} disabled={saving || !category || !customLabel.trim() || !file}>
            {saving ? 'Ajout…' : 'Ajouter'}
          </FloatButton>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        <p className="text-[11px] text-warm-400">Formats acceptés : PDF, image… — 1 Mo maximum.</p>
        <p className="text-xs text-warm-400"><span className="font-semibold text-red-400">*</span> champs obligatoires</p>
      </div>

      {/* ── Tableau (trié par catégorie) ── */}
      {documents.length === 0 ? (
        <div className="card py-12 text-center max-w-3xl">
          <FileText size={32} className="text-warm-300 mx-auto" />
          <p className="text-sm text-warm-400 mt-2">Aucun document pour le moment.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden max-w-4xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-warm-100">
                <th className="list-th w-32">Catégorie</th>
                <th className="list-th">Document</th>
                <th className="list-th">Fichier</th>
                <th className="list-th w-28">Expiration</th>
                <th className="list-th w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {sortedDocs.map(doc => {
                const exp = expirationStatus(doc.expires_at)
                const categoryLabel = CATEGORIES.find(c => c.key === doc.category)?.label ?? doc.category
                return (
                  <tr key={doc.id} className="hover:bg-warm-50/50 transition-colors">
                    <td className="list-td text-secondary-700 whitespace-nowrap">{categoryLabel}</td>
                    <td className="list-td">
                      <span className="list-name text-secondary-800 truncate">
                        {doc.label || <span className="text-warm-300">—</span>}
                      </span>
                    </td>
                    <td className="list-td">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText size={13} className="text-warm-400 flex-shrink-0" />
                        <span className="text-xs text-warm-500 truncate">{doc.file_name}</span>
                      </div>
                    </td>
                    <td className="list-td whitespace-nowrap">
                      {doc.expires_at ? (
                        <span className={clsx(
                          'text-[11px] px-1.5 py-0.5 rounded font-medium',
                          exp === 'expired' ? 'bg-red-100 text-red-600'
                            : exp === 'soon' ? 'bg-amber-100 text-amber-700'
                            : 'bg-warm-100 text-warm-500'
                        )}>
                          {exp === 'expired' ? 'Expiré' : `Exp. ${formatDate(doc.expires_at)}`}
                        </span>
                      ) : <span className="text-warm-300">—</span>}
                    </td>
                    <td className="list-td">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content="Aperçu">
                          <button
                            onClick={() => handlePreview(doc.file_url)}
                            aria-label="Aperçu du document"
                            className="p-1 text-warm-400 hover:text-primary-600 hover:bg-warm-100 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                          >
                            <Eye size={14} />
                          </button>
                        </Tooltip>
                        <Tooltip content="Télécharger">
                          <button
                            onClick={() => handleDownload(doc.file_url, doc.file_name)}
                            aria-label="Télécharger le document"
                            className="p-1 text-warm-400 hover:text-primary-600 hover:bg-warm-100 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50"
                          >
                            <Download size={14} />
                          </button>
                        </Tooltip>
                        {confirmDelete === doc.id ? (
                          <span className="flex items-center gap-1 text-[11px]">
                            <button onClick={() => handleDelete(doc.id)} className="text-red-600 font-semibold hover:underline">Oui</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-warm-500 font-semibold hover:underline">Non</button>
                          </span>
                        ) : (
                          <Tooltip content="Supprimer">
                            <button
                              onClick={() => setConfirmDelete(doc.id)}
                              aria-label="Supprimer le document"
                              className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500/50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
