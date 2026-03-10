'use client'

import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, GripVertical, Check, X } from 'lucide-react'
import type { DocumentCategory } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type DocTypeRow = {
  id: string
  category: DocumentCategory
  doc_key: string
  label: string
  is_required: boolean
  order_index: number
}

interface Props {
  etablissementId: string
  initialDocTypes: DocTypeRow[]
}

// ─── Catégories ───────────────────────────────────────────────────────────────

const CATEGORIES: { key: DocumentCategory; label: string }[] = [
  { key: 'identite',  label: "Documents d'identité" },
  { key: 'medical',   label: 'Documents médicaux' },
  { key: 'assurance', label: 'Attestations & assurances' },
  { key: 'autres',    label: 'Autres documents' },
]

// Types par défaut suggérés (pour le bouton "Initialiser")
const DEFAULT_TYPES: { category: DocumentCategory; doc_key: string; label: string; is_required: boolean }[] = [
  { category: 'identite',  doc_key: 'cni',                label: "Carte nationale d'identité",       is_required: false },
  { category: 'identite',  doc_key: 'passeport',          label: 'Passeport',                        is_required: false },
  { category: 'identite',  doc_key: 'livret_famille',     label: 'Livret de famille',                is_required: false },
  { category: 'identite',  doc_key: 'photo_identite',     label: "Photos d'identité",                is_required: true },
  { category: 'identite',  doc_key: 'jugement_garde',     label: 'Jugement de garde',                is_required: false },
  { category: 'medical',   doc_key: 'certificat_medical', label: 'Certificat médical',               is_required: true },
  { category: 'medical',   doc_key: 'carnet_vaccination', label: 'Carnet de vaccinations',           is_required: false },
  { category: 'medical',   doc_key: 'fiche_sanitaire',    label: 'Fiche sanitaire / urgence',        is_required: true },
  { category: 'assurance', doc_key: 'assurance_scolaire', label: "Attestation d'assurance scolaire", is_required: true },
  { category: 'assurance', doc_key: 'certificat_scolarite_ancien', label: 'Certificat de scolarité (ancien établissement)', is_required: false },
  { category: 'assurance', doc_key: 'reglement_signe',    label: 'Règlement intérieur signé',        is_required: true },
  { category: 'assurance', doc_key: 'droit_image',        label: "Autorisation droit à l'image",     is_required: false },
  { category: 'autres',    doc_key: 'rib',                label: 'RIB',                              is_required: false },
  { category: 'autres',    doc_key: 'justificatif_domicile', label: 'Justificatif de domicile',      is_required: false },
  { category: 'autres',    doc_key: 'autre',              label: 'Autre document',                   is_required: false },
]

// ─── Composant principal ────────────────────────────────────────────────────

export default function DocumentTypesConfig({ etablissementId, initialDocTypes }: Props) {
  const supabase = createClient()
  const [docTypes, setDocTypes] = useState(initialDocTypes)
  const [adding, setAdding] = useState<DocumentCategory | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newRequired, setNewRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const byCategory = (cat: DocumentCategory) =>
    docTypes.filter(d => d.category === cat).sort((a, b) => a.order_index - b.order_index)

  // ─── Initialiser une catégorie avec les types par défaut ─────────────────────

  const [initializingCat, setInitializingCat] = useState<DocumentCategory | null>(null)

  const handleInitCategory = useCallback(async (category: DocumentCategory) => {
    setInitializingCat(category)
    const catDefaults = DEFAULT_TYPES.filter(d => d.category === category)
    const maxOrder = Math.max(0, ...docTypes.filter(d => d.category === category).map(d => d.order_index))

    const rows = catDefaults.map((d, i) => ({
      etablissement_id: etablissementId,
      category: d.category,
      doc_key: d.doc_key,
      label: d.label,
      is_required: d.is_required,
      order_index: maxOrder + i + 1,
    }))

    const { data, error } = await supabase
      .from('document_type_configs')
      .upsert(rows, { onConflict: 'etablissement_id,doc_key' })
      .select('id, category, doc_key, label, is_required, order_index')

    if (!error && data) {
      setDocTypes(prev => [...prev.filter(d => d.category !== category || !catDefaults.some(cd => cd.doc_key === d.doc_key)), ...(data as DocTypeRow[])])
    }
    setInitializingCat(null)
  }, [etablissementId, docTypes, supabase])

  // ─── Ajouter un type ──────────────────────────────────────────────────────

  const handleAdd = useCallback(async (category: DocumentCategory) => {
    if (!newLabel.trim()) return
    setSaving(true)

    const key = newLabel.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    const maxOrder = Math.max(0, ...docTypes.filter(d => d.category === category).map(d => d.order_index))

    const { data, error } = await supabase
      .from('document_type_configs')
      .insert({
        etablissement_id: etablissementId,
        category,
        doc_key: `custom_${key}_${Date.now()}`,
        label: newLabel.trim(),
        is_required: newRequired,
        order_index: maxOrder + 1,
      })
      .select('id, category, doc_key, label, is_required, order_index')
      .single()

    if (!error && data) {
      setDocTypes(prev => [...prev, data as DocTypeRow])
    }
    setNewLabel('')
    setNewRequired(false)
    setAdding(null)
    setSaving(false)
  }, [newLabel, newRequired, docTypes, etablissementId, supabase])

  // ─── Basculer requis ──────────────────────────────────────────────────────

  const toggleRequired = useCallback(async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('document_type_configs')
      .update({ is_required: !current })
      .eq('id', id)

    if (!error) {
      setDocTypes(prev => prev.map(d => d.id === id ? { ...d, is_required: !current } : d))
    }
  }, [supabase])

  // ─── Supprimer ──────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('document_type_configs')
      .delete()
      .eq('id', id)

    if (!error) {
      setDocTypes(prev => prev.filter(d => d.id !== id))
    }
    setConfirmDelete(null)
  }, [supabase])

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-warm-700">Documents requis par dossier</h2>
        <p className="text-xs text-warm-400 mt-0.5">
          Configurez les types de documents attendus pour chaque élève.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(cat => {
          const items = byCategory(cat.key)
          return (
            <div key={cat.key} className="card">
              <div className="px-3 py-1.5 border-b border-warm-200 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-warm-600 uppercase tracking-wide">{cat.label}</h3>
                <button
                  onClick={() => { setAdding(cat.key); setNewLabel(''); setNewRequired(false) }}
                  className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                  disabled={adding === cat.key}
                >
                  <Plus size={11} /> Ajouter
                </button>
              </div>

              {items.length === 0 && adding !== cat.key && (
                <div className="px-3 py-2 flex items-center justify-between">
                  <p className="text-[11px] text-warm-300 italic">Aucun document réclamé.</p>
                  {DEFAULT_TYPES.some(d => d.category === cat.key) && (
                    <button
                      onClick={() => handleInitCategory(cat.key)}
                      disabled={initializingCat === cat.key}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {initializingCat === cat.key ? 'Initialisation...' : 'Types par défaut'}
                    </button>
                  )}
                </div>
              )}

              <div className="divide-y divide-warm-50">
                {items.map(d => (
                  <div key={d.id} className="px-3 py-1.5 flex items-center gap-2 hover:bg-warm-50/50 group">
                    <GripVertical size={11} className="text-warm-200 flex-shrink-0" />
                    <span className="text-xs text-warm-700 flex-1 truncate">{d.label}</span>

                    {/* Badge requis cliquable */}
                    <button
                      onClick={() => toggleRequired(d.id, d.is_required)}
                      className={clsx(
                        'text-[9px] font-medium px-1.5 py-0.5 rounded-full transition-colors whitespace-nowrap',
                        d.is_required
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-warm-100 text-warm-400 hover:bg-warm-200'
                      )}
                    >
                      {d.is_required ? 'Requis' : 'Optionnel'}
                    </button>

                    {/* Suppression */}
                    {confirmDelete === d.id ? (
                      <div className="flex items-center gap-1 text-[11px]">
                        <button onClick={() => handleDelete(d.id)} className="text-red-600 font-semibold hover:underline">Oui</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-warm-500 font-semibold hover:underline">Non</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(d.id)}
                        className="text-warm-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}

                {/* Formulaire inline d'ajout */}
                {adding === cat.key && (
                  <div className="px-3 py-1.5 flex items-center gap-1.5 bg-warm-50/50">
                    <input
                      type="text"
                      placeholder="Nom du type..."
                      className="input text-xs flex-1 min-w-0"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdd(cat.key)}
                      autoFocus
                    />
                    <label className="flex items-center gap-0.5 text-[11px] text-warm-500 whitespace-nowrap cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newRequired}
                        onChange={e => setNewRequired(e.target.checked)}
                        className="h-3 w-3 rounded"
                      />
                      Requis
                    </label>
                    <button
                      onClick={() => handleAdd(cat.key)}
                      disabled={saving || !newLabel.trim()}
                      className="text-green-600 hover:text-green-800 disabled:opacity-40"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setAdding(null)}
                      className="text-warm-400 hover:text-warm-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
