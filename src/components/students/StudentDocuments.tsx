'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { Trash2, Eye } from 'lucide-react'
import type { DocumentCategory } from '@/types/database'
import type { FicheEleve } from '@/lib/students/fiche'
import { FloatSelect, FloatInput, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import FormModal from '@/components/ui/FormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Puce } from '@/components/dashboard/tdb'
import { ouvrirDansOnglet } from '@/lib/pdf/ouvrir'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocTypeRow = FicheEleve['docTypeConfigs'][number]

type DocRow = FicheEleve['studentDocuments'][number]

interface Props {
  /** Fiche en lecture seule (enseignant). La RLS refuse desormais l'ecriture
   *  (lot 3 du chantier RLS) : sans cela, les boutons resteraient offerts et
   *  echoueraient EN SILENCE — une ecriture ecartee par la RLS ne leve rien,
   *  elle touche zero ligne. Meme regle que le formulaire depuis le 24/09. */
  lectureSeule?: boolean
  studentId: string
  etablissementId: string
  docTypes: DocTypeRow[]
  documents: DocRow[]
}

// ─── Catégories ───────────────────────────────────────────────────────────────

const CATEGORIES: { key: DocumentCategory; label: string }[] = [
  { key: 'identite',  label: "Documents d'identité" },
  { key: 'medical',   label: 'Documents médicaux' },
  { key: 'assurance', label: 'Attestations & assurances' },
  { key: 'autres',    label: 'Autres documents' },
]

// « AAAA-MM-JJ » -> « JJ/MM/AAAA » par decoupage : `new Date('AAAA-MM-JJ')` est
// lu en UTC et pouvait afficher la veille.
const dateFr = (d: string) => d.slice(0, 10).split('-').reverse().join('/')

// ─── Composant principal ────────────────────────────────────────────────────

export default function StudentDocuments({ studentId, etablissementId, docTypes, documents: initialDocs, lectureSeule = false }: Props) {
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

  // ─── Signed URL (bucket privé) ──────────────────────────────────────────────

  const getSignedUrl = useCallback(async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('student-documents')
      .createSignedUrl(filePath, 60)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  }, [supabase])

  // Maps
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
    // Un badge d'expiration n'a besoin d'etre juste qu'au moment ou on le lit ;
    // figer « maintenant » dans un etat le rendrait FAUX sur un onglet laisse ouvert.
    // eslint-disable-next-line react-hooks/purity
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
    // LA LIGNE D'ABORD, LE FICHIER ENSUITE. L'ordre inverse detruisait la piece
    // avant de savoir si la ligne pouvait partir : une suppression ecartee par la
    // RLS ne leve RIEN, donc le document restait a l'ecran, prive de son fichier.
    const echec = erreurEcriture(
      await supabase.from('student_documents').delete().eq('id', docId).select('id'),
      'Ce document',
    )
    if (echec) { setError(echec); setConfirmDelete(null); return }

    const doc = documents.find(d => d.id === docId)
    if (doc) {
      await supabase.storage.from('student-documents').remove([doc.file_url])
    }
    setDocuments(prev => prev.filter(d => d.id !== docId))
    setConfirmDelete(null)
  }, [documents, supabase])

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  // Charte du 15/10 : encadres a bandeau `.encadre-titre`, pastilles d'etat
  // (`Puce`), ajout en modale, suppression par confirmation, actions TOUJOURS
  // visibles (au survol seulement, elles etaient introuvables au clavier et sur
  // tablette).

  const complet = completionStats.total > 0 && completionStats.done === completionStats.total
  const typesAjout = uploadingCat
    ? docTypes.filter(d => d.category === uploadingCat).sort((a, b) => a.order_index - b.order_index)
    : []
  const docAConfirmer = confirmDelete ? documents.find(d => d.id === confirmDelete) ?? null : null
  const libelleType = (key: string) => docTypes.find(t => t.doc_key === key)?.label ?? key
  const actionIcone = 'p-1 text-warm-700 rounded-lg transition-colors outline-none focus-visible:ring-2'

  return (
    <div className="space-y-3">

      {/* Completude du dossier */}
      {completionStats.total > 0 && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="stat-label">Complétude du dossier</span>
            <span className={clsx(
              'text-[11px] font-bold tabular-nums',
              complet ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-amber-700',
            )}>
              {completionStats.done} / {completionStats.total} documents requis
            </span>
          </div>
          <div className="w-full h-1.5 bg-warm-100 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                complet ? 'bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)]' : 'bg-amber-500',
              )}
              style={{ width: `${(completionStats.done / completionStats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Categories : 2 par ligne */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
      {CATEGORIES.map(cat => {
        const types = docTypes.filter(d => d.category === cat.key).sort((a, b) => a.order_index - b.order_index)
        const docs = docsByCategory.get(cat.key) ?? []

        return (
          <section key={cat.key} className="card p-3 space-y-1" aria-labelledby={`docs-${cat.key}`}>
            <div className="encadre-titre justify-between gap-2">
              <h2 id={`docs-${cat.key}`} className="text-xs font-bold uppercase tracking-widest">{cat.label}</h2>
              {!lectureSeule && types.length > 0 && (
                <FloatButton
                  variant="submit"
                  size="mini"
                  onClick={() => {
                    setUploadingCat(cat.key)
                    setFormDocType('')
                    setFormExpires('')
                    setFormFile(null)
                    setError(null)
                  }}
                >
                  Ajouter
                </FloatButton>
              )}
            </div>

            {types.length === 0 ? (
              <p className="py-2 text-center text-[11px] text-warm-700 italic">Aucun document attendu.</p>
            ) : (
              <ul className="-mx-3 divide-y divide-warm-50">
                {types.map(t => {
                  const doc = docs.find(d => d.doc_type_key === t.doc_key)
                  const expStatus = doc ? expirationStatus(doc.expires_at) : null

                  return (
                    <li key={t.doc_key} className="px-3 py-1.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={clsx('text-xs', doc ? 'font-medium text-secondary-800' : 'text-warm-700')}>{t.label}</span>
                          {t.is_required && !doc && <Puce ton="danger">Requis</Puce>}
                        </div>
                        {doc && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-warm-700 truncate max-w-[160px]">{doc.file_name}</span>
                            {doc.expires_at && (
                              expStatus === 'expired' ? <Puce ton="danger">Expiré</Puce>
                              : expStatus === 'soon' ? <Puce ton="attente">Bientôt · {dateFr(doc.expires_at)}</Puce>
                              : <Puce ton="ok">{dateFr(doc.expires_at)}</Puce>
                            )}
                          </div>
                        )}
                      </div>

                      {doc && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {/* Une seule action : le document s'affiche dans un nouvel
                              onglet (20/10) ; on l'enregistre depuis la visionneuse. */}
                          <Tooltip content="Ouvrir dans un nouvel onglet">
                            <button
                              type="button"
                              onClick={() => { void ouvrirDansOnglet(() => getSignedUrl(doc.file_url)) }}
                              aria-label={`Ouvrir · ${t.label}`}
                              className={clsx(actionIcone, 'hover:text-[var(--brand-surface)] dark:hover:text-[var(--brand-accent)] hover:bg-[var(--brand-tint)] focus-visible:ring-[var(--brand-focus)]')}
                            >
                              <Eye size={14} />
                            </button>
                          </Tooltip>
                          {!lectureSeule && (
                            <Tooltip content="Supprimer">
                              <button
                                type="button"
                                onClick={() => { setConfirmDelete(doc.id); setError(null) }}
                                aria-label={`Supprimer · ${t.label}`}
                                className={clsx(actionIcone, 'hover:text-red-600 focus-visible:ring-red-500/50')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
      </div>

      {error && !uploadingCat && !docAConfirmer && (
        <p role="alert" className="text-xs text-red-600">{error}</p>
      )}

      {/* ── Modale d'ajout (fermeture X / Annuler seulement) ── */}
      {uploadingCat && (
        <FormModal
          title={`Ajouter · ${CATEGORIES.find(c => c.key === uploadingCat)?.label ?? ''}`}
          onClose={resetForm}
          footer={
            <>
              <FloatButton variant="secondary" onClick={resetForm} disabled={saving}>Annuler</FloatButton>
              <FloatButton variant="submit" onClick={handleUpload} disabled={saving} loading={saving}>Enregistrer</FloatButton>
            </>
          }
        >
          <div className="space-y-3">
            <FloatSelect label="Type de document" required value={formDocType} onChange={e => setFormDocType(e.target.value)}>
              <option value="" disabled hidden />
              {typesAjout.map(t => (
                <option key={t.doc_key} value={t.doc_key}>{t.label}</option>
              ))}
            </FloatSelect>
            <FloatInput label="Expiration" type="date" value={formExpires} onChange={e => setFormExpires(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <FloatButton type="button" variant="secondary" size="mini" onClick={() => fileInputRef.current?.click()}>
                Choisir un fichier
              </FloatButton>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={e => setFormFile(e.target.files?.[0] ?? null)}
              />
              <span className="text-xs text-warm-700 truncate max-w-[240px]">{formFile ? formFile.name : 'Aucun fichier (500 Ko maximum)'}</span>
            </div>
            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          </div>
        </FormModal>
      )}

      {/* ── Confirmation de suppression ── */}
      {docAConfirmer && (
        <ConfirmModal
          title="Supprimer le document ?"
          confirmLabel="Supprimer"
          variant="danger"
          onConfirm={() => handleDelete(docAConfirmer.id)}
          onCancel={() => setConfirmDelete(null)}
        >
          <p className="text-sm text-secondary-700">
            {libelleType(docAConfirmer.doc_type_key)} · {docAConfirmer.file_name}
          </p>
        </ConfirmModal>
      )}

    </div>
  )
}
