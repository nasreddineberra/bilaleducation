'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Download, Eye, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { DocumentCategory } from '@/types/database'
import { FloatSelect, FloatInput, FloatButton } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocTypeRow = {
  id: string
  category: DocumentCategory
  doc_key: string
  label: string
  is_required: boolean
  order_index: number
}

type DocRow = {
  id: string
  doc_type_key: string
  category: DocumentCategory
  file_url: string
  file_name: string
  expires_at: string | null
  created_at: string
}

interface Props {
  studentId: string
  etablissementId: string
  docTypes: DocTypeRow[]
  documents: DocRow[]
}

// ─── Catégories ───────────────────────────────────────────────────────────────

const CATEGORIES: { key: DocumentCategory; label: string; icon: string }[] = [
  { key: 'identite',  label: "Documents d'identité",      icon: '🪪' },
  { key: 'medical',   label: 'Documents médicaux',        icon: '🏥' },
  { key: 'assurance', label: 'Attestations & assurances', icon: '📋' },
  { key: 'autres',    label: 'Autres documents',          icon: '📁' },
]

// ─── Composant principal ────────────────────────────────────────────────────

export default function StudentDocuments({ studentId, etablissementId, docTypes, documents: initialDocs }: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = useState(initialDocs)
  const [uploadingCat, setUploadingCat] = useState<DocumentCategory | null>(null)
  const [formDocType, setFormDocType] = useState('')
  const [formExpires, setFormExpires] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // ─── Signed URL (bucket privé) ──────────────────────────────────────────────

  const getSignedUrl = useCallback(async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('student-documents')
      .createSignedUrl(filePath, 3600) // 1h
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }, [supabase])

  const handlePreview = useCallback(async (filePath: string) => {
    setLoadingPreview(true)
    const url = await getSignedUrl(filePath)
    if (url) setPreviewUrl(url)
    setLoadingPreview(false)
  }, [getSignedUrl])

  const handleDownload = useCallback(async (filePath: string, fileName: string) => {
    const url = await getSignedUrl(filePath)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.target = '_blank'
      a.click()
    }
  }, [getSignedUrl])

  // Maps
  const typeMap = useMemo(() => new Map(docTypes.map(d => [d.doc_key, d])), [docTypes])
  const docsByCategory = useMemo(() => {
    const m = new Map<DocumentCategory, DocRow[]>()
    for (const cat of CATEGORIES) m.set(cat.key, [])
    for (const doc of documents) {
      const arr = m.get(doc.category)
      if (arr) arr.push(doc)
    }
    return m
  }, [documents])

  // ─── Complétude du dossier ────────────────────────────────────────────────

  const completionStats = useMemo(() => {
    const required = docTypes.filter(d => d.is_required)
    const providedKeys = new Set(documents.map(d => d.doc_type_key))
    const fulfilled = required.filter(d => providedKeys.has(d.doc_key))
    return { total: required.length, done: fulfilled.length }
  }, [docTypes, documents])

  // ─── Expiration badge ─────────────────────────────────────────────────────

  const expirationStatus = (expiresAt: string | null): 'ok' | 'soon' | 'expired' | null => {
    if (!expiresAt) return null
    const diff = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (diff < 0) return 'expired'
    if (diff < 30) return 'soon'
    return 'ok'
  }

  // ─── Upload ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setUploadingCat(null)
    setFormDocType('')
    setFormExpires('')
    setFormFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleUpload = useCallback(async () => {
    if (!formDocType) { setError('Veuillez sélectionner un type de document.'); return }
    if (!formFile) { setError('Veuillez sélectionner un fichier.'); return }
    if (formFile.size > 500 * 1024) { setError('Le fichier dépasse 500 Ko. Veuillez le compresser ou choisir un fichier plus léger.'); return }
    if (!uploadingCat) return

    setSaving(true)
    setError(null)

    const filePath = `${etablissementId}/${studentId}/${formDocType}/${Date.now()}_${formFile.name}`

    const { error: uploadErr } = await supabase.storage
      .from('student-documents')
      .upload(filePath, formFile)

    if (uploadErr) {
      setError(uploadErr.message)
      setSaving(false)
      return
    }

    const { data: newDoc, error: insertErr } = await supabase
      .from('student_documents')
      .insert({
        etablissement_id: etablissementId,
        student_id: studentId,
        doc_type_key: formDocType,
        category: uploadingCat,
        file_url: filePath,
        file_name: formFile.name,
        expires_at: formExpires || null,
      })
      .select('id, doc_type_key, category, file_url, file_name, expires_at, created_at')
      .single()

    if (insertErr) {
      setError(insertErr.message)
      setSaving(false)
      return
    }

    if (newDoc) {
      setDocuments(prev => [...prev, newDoc as DocRow])
    }
    resetForm()
    setSaving(false)
  }, [formDocType, formFile, formExpires, uploadingCat, etablissementId, studentId, supabase])

  // ─── Suppression ────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (docId: string) => {
    const doc = documents.find(d => d.id === docId)
    if (doc) {
      await supabase.storage.from('student-documents').remove([doc.file_url])
    }

    const { error } = await supabase
      .from('student_documents')
      .delete()
      .eq('id', docId)

    if (!error) {
      setDocuments(prev => prev.filter(d => d.id !== docId))
    }
    setConfirmDelete(null)
  }, [documents, supabase])

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* Barre de complétude */}
      {completionStats.total > 0 && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-warm-600">
              Complétude du dossier
            </span>
            <span className={clsx(
              'text-[11px] font-bold',
              completionStats.done === completionStats.total ? 'text-green-600' : 'text-amber-600'
            )}>
              {completionStats.done} / {completionStats.total} documents requis
            </span>
          </div>
          <div className="w-full h-1.5 bg-warm-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                completionStats.done === completionStats.total ? 'bg-green-500' : 'bg-amber-500'
              )}
              style={{ width: `${completionStats.total > 0 ? (completionStats.done / completionStats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Catégories — 2 par ligne */}
      <div className="grid grid-cols-2 gap-3">
      {CATEGORIES.map(cat => {
        const types = docTypes.filter(d => d.category === cat.key).sort((a, b) => a.order_index - b.order_index)
        const docs = docsByCategory.get(cat.key) ?? []
        const providedKeys = new Set(docs.map(d => d.doc_type_key))

        return (
          <div key={cat.key} className="card">
            <div className="px-3 py-1.5 border-b border-warm-200 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold text-warm-600 uppercase tracking-wide">{cat.label}</h3>
              <FloatButton
                variant="submit"
                onClick={() => {
                  setUploadingCat(cat.key)
                  setFormDocType(types[0]?.doc_key ?? '')
                  setFormExpires('')
                  setFormFile(null)
                  setError(null)
                }}
                className="text-xs flex items-center gap-1"
                disabled={uploadingCat === cat.key || types.length === 0}
              >
                <Plus size={11} /> Ajouter
              </FloatButton>
            </div>

            {types.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-warm-300 italic">
                Aucun document attendu.
              </p>
            )}

            {/* Formulaire d'upload */}
            {uploadingCat === cat.key && (
              <div className="px-3 py-2 border-b border-warm-200 bg-warm-50/50 space-y-2">
                <div className="space-y-2">
                  <div>
                    <FloatSelect
                      label="Type"
                      className="text-xs"
                      value={formDocType}
                      onChange={e => setFormDocType(e.target.value)}
                    >
                      {types.map(t => (
                        <option key={t.doc_key} value={t.doc_key}>{t.label}</option>
                      ))}
                    </FloatSelect>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <FloatInput
                        label="Expiration"
                        type="date"
                        className="text-xs"
                        value={formExpires}
                        onChange={e => setFormExpires(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-warm-600 mb-0.5">Fichier</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="text-xs text-warm-600 file:mr-1 file:py-0.5 file:px-1.5 file:rounded file:border-0 file:text-[10px] file:bg-primary/10 file:text-primary w-full"
                        onChange={e => setFormFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                </div>
                {error && <p className="text-[11px] text-red-600">{error}</p>}
                <div className="flex gap-2">
                  <FloatButton variant="submit" onClick={handleUpload} disabled={saving} loading={saving} className="text-xs">
                    Enregistrer
                  </FloatButton>
                  <FloatButton variant="secondary" onClick={resetForm} disabled={saving} className="text-xs">Annuler</FloatButton>
                </div>
              </div>
            )}

            {/* Liste des documents fournis + manquants */}
            <div className="divide-y divide-warm-50">
              {types.map(t => {
                const doc = docs.find(d => d.doc_type_key === t.doc_key)
                const expStatus = doc ? expirationStatus(doc.expires_at) : null

                return (
                  <div key={t.doc_key} className="px-3 py-1.5 flex items-center gap-2 group">
                    {/* Indicateur statut */}
                    {doc ? (
                      <CheckCircle2 size={12} className={clsx(
                        expStatus === 'expired' ? 'text-red-500' :
                        expStatus === 'soon' ? 'text-amber-500' :
                        'text-green-500'
                      )} />
                    ) : (
                      t.is_required
                        ? <AlertCircle size={12} className="text-red-400" />
                        : <FileText size={12} className="text-warm-200" />
                    )}

                    {/* Nom du type */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('text-xs', doc ? 'text-warm-700' : 'text-warm-400')}>
                          {t.label}
                        </span>
                        {t.is_required && !doc && (
                          <span className="text-[9px] font-medium px-1 py-0.5 rounded-full bg-red-100 text-red-600">Requis</span>
                        )}
                      </div>

                      {doc && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-warm-400 truncate max-w-[120px]">{doc.file_name}</span>
                          {doc.expires_at && (
                            <span className={clsx(
                              'text-[9px] font-medium px-1 py-0.5 rounded-full',
                              expStatus === 'expired' ? 'bg-red-100 text-red-600' :
                              expStatus === 'soon' ? 'bg-amber-100 text-amber-600' :
                              'bg-green-100 text-green-600'
                            )}>
                              {expStatus === 'expired' ? 'Expiré' :
                               expStatus === 'soon' ? 'Bientôt' :
                               `${new Date(doc.expires_at).toLocaleDateString('fr-FR')}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {doc && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handlePreview(doc.file_url)}
                          disabled={loadingPreview}
                          className="text-warm-400 hover:text-primary transition-colors"
                          title="Aperçu"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => handleDownload(doc.file_url, doc.file_name)}
                          className="text-warm-400 hover:text-primary transition-colors"
                          title="Télécharger"
                        >
                          <Download size={12} />
                        </button>
                        {confirmDelete === doc.id ? (
                          <div className="flex items-center gap-1 text-[11px]">
                            <button onClick={() => handleDelete(doc.id)} className="text-red-600 font-semibold hover:underline">Oui</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-warm-500 font-semibold hover:underline">Non</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(doc.id)}
                            className="text-warm-400 hover:text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
      </div>

      {/* Modale aperçu */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-start pt-8 p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewUrl(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
            <div className="px-4 py-2.5 border-b border-warm-100 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xs font-bold text-secondary-800">Aperçu du document</h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-1.5 text-warm-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
              {previewUrl.match(/\.pdf|\/pdf/i) ? (
                <iframe src={previewUrl} className="w-full h-full min-h-[500px] rounded" />
              ) : (
                <img src={previewUrl} alt="Document" className="max-w-full max-h-full object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
