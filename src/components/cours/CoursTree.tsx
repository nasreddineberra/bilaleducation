'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, ChevronDown, BookOpen,
  Plus, Pencil, Trash2, Check, X, Search, GripVertical,
} from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { UniteEnseignement, CoursModule, Cours } from '@/types/database'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldDef = {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; dir?: string
  maxWidth?: string  // largeur fixe pour les champs courts (ex. Ref)
}

type AddingKind =
  | { kind: 'ue' }
  | { kind: 'module'; ueId: string }
  | { kind: 'cours';  ueId: string; moduleId: string | null }

type EditingKind =
  | { kind: 'ue';     item: UniteEnseignement }
  | { kind: 'module'; item: CoursModule }
  | { kind: 'cours';  item: Cours }

type DeleteKind =
  | { kind: 'ue';     id: string; nom: string }
  | { kind: 'module'; id: string; nom: string }
  | { kind: 'cours';  id: string; nom: string }

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  ues:             UniteEnseignement[]
  modules:         CoursModule[]
  cours:           Cours[]
  etablissementId: string
}

// Props partagées transmises à SortableUECard
interface SharedCardProps {
  modules:          CoursModule[]
  cours:            Cours[]
  expandedUEs:      Set<string>
  expandedModules:  Set<string>
  adding:           AddingKind | null
  editing:          EditingKind | null
  error:            string | null
  submitting:       boolean
  fNomFr:           string
  fNomAr:           string
  fRef:             string
  setFNomFr:        (v: string) => void
  setFNomAr:        (v: string) => void
  setFRef:          (v: string) => void
  ueFields:         FieldDef[]
  moduleFields:     FieldDef[]
  coursFields:      FieldDef[]
  toggleUE:         (id: string) => void
  toggleModule:     (id: string) => void
  openEdit:         (e: EditingKind) => void
  openAdd:          (a: AddingKind) => void
  cancel:           () => void
  setConfirmDelete: (d: DeleteKind) => void
  setDeleteError:   (s: string | null) => void
  handleEditUE:     (id: string) => Promise<void>
  handleEditModule: (id: string) => Promise<void>
  handleEditCours:  (id: string) => Promise<void>
  handleAddModule:  (ueId: string) => Promise<void>
  handleAddCours:   (ueId: string, moduleId: string | null) => Promise<void>
  search:           string
}

// ─── Formulaire inline avec mini-libellés ─────────────────────────────────────

function InlineForm({
  fields, onSubmit, onCancel, submitting,
}: {
  fields: FieldDef[]; onSubmit: () => void; onCancel: () => void; submitting: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-2 mt-1 mb-2 pl-1">
      {fields.map((f, i) => (
        <div
          key={i}
          className="flex flex-col gap-0.5"
          style={f.maxWidth ? { width: f.maxWidth, flexShrink: 0 } : { flex: '1 1 120px' }}
        >
          <label className="text-[10px] font-semibold text-warm-400 uppercase tracking-wide px-0.5 leading-none">
            {f.label}
          </label>
          {f.type === 'color' ? (
            <input
              type="color"
              value={f.value || '#3B82F6'}
              onChange={e => f.onChange(e.target.value)}
              className="w-full h-8 rounded cursor-pointer border border-warm-200"
              disabled={submitting}
            />
          ) : (
            <input
              type={f.type ?? 'text'}
              dir={f.dir ?? 'auto'}
              value={f.value}
              onChange={e => f.onChange(e.target.value)}
              placeholder={f.placeholder ?? ''}
              className="input text-sm py-1 w-full"
              disabled={submitting}
              autoFocus={i === 0}
            />
          )}
        </div>
      ))}
      <button onClick={onSubmit} disabled={submitting} className="btn btn-primary py-1 px-3 text-sm self-end">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="btn btn-secondary py-1 px-3 text-sm self-end">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Helper : nom en arabe ────────────────────────────────────────────────────

const arStyle: React.CSSProperties = { fontFamily: "'Amiri Typewriter', serif" }

// ─── Surlignage du texte recherché ───────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  const q = query.trim().toLowerCase()
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q
          ? <mark key={i} className="bg-amber-200 text-amber-900 rounded-sm not-italic px-px">{part}</mark>
          : part ? <span key={i}>{part}</span> : null
      )}
    </>
  )
}

// ─── Ligne de cours ────────────────────────────────────────────────────────────

function CourseRow({
  c, editing, fNomFr, setFNomFr, fNomAr, setFNomAr, fRef, setFRef,
  coursFields, error, submitting,
  openEdit, setConfirmDelete, setDeleteError, onSubmit, onCancel, search,
}: {
  c:               Cours
  editing:         EditingKind | null
  fNomFr:          string; setFNomFr: (v: string) => void
  fNomAr:          string; setFNomAr: (v: string) => void
  fRef:            string; setFRef:   (v: string) => void
  coursFields:     FieldDef[]
  error:           string | null
  submitting:      boolean
  openEdit:        (e: EditingKind) => void
  setConfirmDelete:(d: DeleteKind) => void
  setDeleteError:  (s: string | null) => void
  onSubmit:        () => void
  onCancel:        () => void
  search:          string
}) {
  void setFNomFr; void setFNomAr; void setFRef

  const isEditing = editing?.kind === 'cours' && editing.item.id === c.id

  if (isEditing) {
    return (
      <div>
        {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
        <InlineForm fields={coursFields} onSubmit={onSubmit} onCancel={onCancel} submitting={submitting} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 group py-0.5 px-1 -mx-1 rounded hover:bg-primary-50 transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-warm-300 flex-shrink-0 self-center" />
      {/* Ref */}
      {c.code && (
        <span className="text-[10px] font-mono text-warm-400 bg-warm-100 px-1 py-px rounded flex-shrink-0">
          <Highlight text={c.code} query={search} />
        </span>
      )}
      {/* FR · AR */}
      <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
        <span dir="auto" className="font-semibold text-secondary-700 text-sm"><Highlight text={c.nom_fr} query={search} /></span>
        {c.nom_ar && <span className="text-warm-300 flex-shrink-0 select-none">·</span>}
        {c.nom_ar && (
          <span dir="auto" className="text-sm font-bold text-warm-500" style={arStyle}><Highlight text={c.nom_ar} query={search} /></span>
        )}
      </div>
      <button
        onClick={() => openEdit({ kind: 'cours', item: c })}
        className="p-1 text-warm-300 hover:text-primary-600 hover:bg-primary-50 rounded opacity-0 group-hover:opacity-100 transition-all"
        title="Modifier"
      >
        <Pencil size={12} />
      </button>
      <button
        onClick={() => { setConfirmDelete({ kind: 'cours', id: c.id, nom: c.nom_fr }); setDeleteError(null) }}
        className="p-1 text-warm-300 hover:text-danger-500 hover:bg-danger-50 rounded opacity-0 group-hover:opacity-100 transition-all"
        title="Supprimer"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}

// ─── Carte Module triable (DnD) ──────────────────────────────────────────────

function SortableModuleRow({ mod, ue, shared }: { mod: CoursModule; ue: UniteEnseignement; shared: SharedCardProps }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const {
    cours, expandedModules, adding, editing, error, submitting,
    fNomFr, fNomAr, fRef, setFNomFr, setFNomAr, setFRef,
    moduleFields, coursFields, toggleModule, openEdit, openAdd, cancel,
    setConfirmDelete, setDeleteError, handleEditModule, handleEditCours, handleAddCours,
    search,
  } = shared

  const modExpanded  = expandedModules.has(mod.id)
  const modCours     = cours.filter(c => c.module_id === mod.id)
  const isEditingMod = editing?.kind === 'module' && editing.item.id === mod.id

  return (
    <div ref={setNodeRef} style={style} className="ml-5 border border-warm-100 rounded-lg overflow-hidden mb-px">
      {/* En-tête module */}
      <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white">
        {/* Poignée DnD module */}
        <button
          {...attributes}
          {...listeners}
          className="text-warm-300 hover:text-warm-500 cursor-grab active:cursor-grabbing flex-shrink-0"
          tabIndex={-1}
          title="Réordonner"
        >
          <GripVertical size={12} />
        </button>
        {/* Flèche expand/collapse */}
        <button onClick={() => toggleModule(mod.id)} className="text-warm-400 hover:text-secondary-600 transition-colors flex-shrink-0">
          {modExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {isEditingMod ? (
          <div className="flex-1">
            {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
            <InlineForm fields={moduleFields} onSubmit={() => handleEditModule(mod.id)} onCancel={cancel} submitting={submitting} />
          </div>
        ) : (
          <>
            <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
              {mod.code && (
                <span className="text-[10px] font-mono text-warm-400 bg-warm-100 px-1 py-px rounded flex-shrink-0">
                  <Highlight text={mod.code} query={search} />
                </span>
              )}
              <span dir="auto" className="font-semibold text-secondary-700 text-sm"><Highlight text={mod.nom_fr} query={search} /></span>
              {mod.nom_ar && <span className="text-warm-300 flex-shrink-0 select-none">·</span>}
              {mod.nom_ar && (
                <span dir="auto" className="text-sm font-bold text-warm-500" style={arStyle}><Highlight text={mod.nom_ar} query={search} /></span>
              )}
            </div>
            <button onClick={() => openEdit({ kind: 'module', item: mod })} className="p-1 text-warm-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors flex-shrink-0" title="Modifier">
              <Pencil size={12} />
            </button>
            <button onClick={() => { setConfirmDelete({ kind: 'module', id: mod.id, nom: mod.nom_fr }); setDeleteError(null) }} className="p-1 text-warm-400 hover:text-danger-500 hover:bg-danger-50 rounded transition-colors flex-shrink-0" title="Supprimer">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {/* Cours du module */}
      {modExpanded && (
        <div className="pl-10 pr-2 pb-1 space-y-0 bg-warm-50/50">
          {modCours.map(c => (
            <CourseRow
              key={c.id} c={c} editing={editing}
              fNomFr={fNomFr} setFNomFr={setFNomFr}
              fNomAr={fNomAr} setFNomAr={setFNomAr}
              fRef={fRef} setFRef={setFRef}
              coursFields={coursFields}
              error={error} submitting={submitting}
              openEdit={openEdit}
              setConfirmDelete={setConfirmDelete}
              setDeleteError={setDeleteError}
              onSubmit={() => handleEditCours(c.id)}
              onCancel={cancel}
              search={search}
            />
          ))}
          {adding?.kind === 'cours' && adding.moduleId === mod.id ? (
            <div>
              {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
              <InlineForm fields={coursFields} onSubmit={() => handleAddCours(ue.id, mod.id)} onCancel={cancel} submitting={submitting} />
            </div>
          ) : (
            <button onClick={() => openAdd({ kind: 'cours', ueId: ue.id, moduleId: mod.id })} className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 mt-px py-px">
              <Plus size={11} /> Ajouter un cours
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Carte UE triable (DnD) ────────────────────────────────────────────────────

function SortableUECard({ ue, shared }: { ue: UniteEnseignement; shared: SharedCardProps }) {
  const {
    modules, cours, expandedUEs, expandedModules, adding, editing,
    error, submitting,
    fNomFr, fNomAr, fRef, setFNomFr, setFNomAr, setFRef,
    ueFields, moduleFields, coursFields,
    toggleUE, toggleModule, openEdit, openAdd, cancel,
    setConfirmDelete, setDeleteError,
    handleEditUE, handleEditModule, handleEditCours,
    handleAddModule, handleAddCours,
    search,
  } = shared

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ue.id })

  const style = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.5 : 1,
  }

  const ueExpanded  = expandedUEs.has(ue.id)
  const directCours = cours.filter(c => c.unite_enseignement_id === ue.id && c.module_id === null)
  const isEditingUE = editing?.kind === 'ue' && editing.item.id === ue.id

  // DnD modules
  const [orderedMods, setOrderedMods] = useState<CoursModule[]>(
    modules.filter(m => m.unite_enseignement_id === ue.id)
  )
  useEffect(() => {
    setOrderedMods(modules.filter(m => m.unite_enseignement_id === ue.id))
  }, [modules])
  const modSensors = useSensors(useSensor(PointerSensor))
  const handleModuleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedMods.findIndex(m => m.id === active.id)
    const newIndex = orderedMods.findIndex(m => m.id === over.id)
    const reordered = arrayMove(orderedMods, oldIndex, newIndex)
    setOrderedMods(reordered)
    const supabase = createClient()
    await Promise.all(
      reordered.map((mod, i) =>
        supabase.from('cours_modules').update({ order_index: i }).eq('id', mod.id)
      )
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="card-flush overflow-hidden">

      {/* ── En-tête UE ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white">

        {/* Poignée de glissement */}
        <button
          {...attributes}
          {...listeners}
          className="text-warm-300 hover:text-warm-500 cursor-grab active:cursor-grabbing flex-shrink-0"
          tabIndex={-1}
          title="Réordonner"
        >
          <GripVertical size={14} />
        </button>

        {/* Pastille couleur (avant le chevron) */}
        <span
          className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
          style={{ backgroundColor: ue.color ?? '#d1d5db' }}
        />

        {/* Flèche expand/collapse */}
        <button
          onClick={() => toggleUE(ue.id)}
          className="text-warm-500 hover:text-secondary-700 transition-colors flex-shrink-0"
        >
          {ueExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {isEditingUE ? (
          <div className="flex-1">
            {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
            <InlineForm fields={ueFields} onSubmit={() => handleEditUE(ue.id)} onCancel={cancel} submitting={submitting} />
          </div>
        ) : (
          <>
            {/* REF - FR - AR sur une ligne */}
            <div className="flex-1 flex items-center gap-2 min-w-0 flex-wrap">
              {ue.code && (
                <span className="text-xs font-mono text-warm-400 bg-warm-100 px-1.5 py-px rounded flex-shrink-0"><Highlight text={ue.code} query={search} /></span>
              )}
              <span dir="auto" className="font-bold text-secondary-800 text-sm"><Highlight text={ue.nom_fr} query={search} /></span>
              {ue.nom_ar && <span className="text-warm-300 flex-shrink-0 select-none">·</span>}
              {ue.nom_ar && (
                <span dir="auto" className="text-sm font-bold text-warm-500" style={arStyle}><Highlight text={ue.nom_ar} query={search} /></span>
              )}
            </div>
            <button onClick={() => openEdit({ kind: 'ue', item: ue })} className="p-0.5 text-warm-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors flex-shrink-0" title="Modifier">
              <Pencil size={12} />
            </button>
            <button onClick={() => { setConfirmDelete({ kind: 'ue', id: ue.id, nom: ue.nom_fr }); setDeleteError(null) }} className="p-0.5 text-warm-400 hover:text-danger-500 hover:bg-danger-50 rounded transition-colors flex-shrink-0" title="Supprimer">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {/* ── Corps UE (déplié) ── */}
      {ueExpanded && (
        <div className="px-3 py-1 space-y-px">

          {/* Modules (triables par DnD) */}
          <DndContext sensors={modSensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
            <SortableContext items={orderedMods.map(m => m.id)} strategy={verticalListSortingStrategy}>
              {orderedMods.map(mod => (
                <SortableModuleRow key={mod.id} mod={mod} ue={ue} shared={shared} />
              ))}
            </SortableContext>
          </DndContext>

          {/* Bouton + module */}
          {adding?.kind === 'module' && adding.ueId === ue.id ? (
            <div className="mt-0.5 ml-5">
              {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
              <InlineForm fields={moduleFields} onSubmit={() => handleAddModule(ue.id)} onCancel={cancel} submitting={submitting} />
            </div>
          ) : (
            <button onClick={() => openAdd({ kind: 'module', ueId: ue.id })} className="ml-5 text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 py-px mt-px">
              <Plus size={11} /> Ajouter un module
            </button>
          )}

          {/* Cours directs */}
          {(directCours.length > 0 || (adding?.kind === 'cours' && adding.moduleId === null && adding.ueId === ue.id)) && (
            <div className="mt-px ml-5">
              <p className="text-xs text-warm-400 uppercase tracking-widest mb-px">── Cours directs ──</p>
              {directCours.map(c => (
                <CourseRow
                  key={c.id} c={c} editing={editing}
                  fNomFr={fNomFr} setFNomFr={setFNomFr}
                  fNomAr={fNomAr} setFNomAr={setFNomAr}
                  fRef={fRef} setFRef={setFRef}
                  coursFields={coursFields}
                  error={error} submitting={submitting}
                  openEdit={openEdit}
                  setConfirmDelete={setConfirmDelete}
                  setDeleteError={setDeleteError}
                  onSubmit={() => handleEditCours(c.id)}
                  onCancel={cancel}
                  search={search}
                />
              ))}
              {adding?.kind === 'cours' && adding.moduleId === null && adding.ueId === ue.id && (
                <div>
                  {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
                  <InlineForm fields={coursFields} onSubmit={() => handleAddCours(ue.id, null)} onCancel={cancel} submitting={submitting} />
                </div>
              )}
            </div>
          )}

          {/* Bouton cours direct */}
          {directCours.length === 0 && !(adding?.kind === 'cours' && adding.moduleId === null && adding.ueId === ue.id) && (
            <button onClick={() => openAdd({ kind: 'cours', ueId: ue.id, moduleId: null })} className="ml-5 text-xs text-warm-400 hover:text-primary-500 flex items-center gap-1 py-px mt-px">
              <Plus size={11} /> Ajouter un cours direct
            </button>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CoursTree({ ues, modules, cours, etablissementId }: Props) {
  const router = useRouter()

  const [orderedUEs,      setOrderedUEs]      = useState<UniteEnseignement[]>(ues)
  const [expandedUEs,     setExpandedUEs]     = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [adding,          setAdding]          = useState<AddingKind | null>(null)
  const [editing,         setEditing]         = useState<EditingKind | null>(null)
  const [confirmDelete,   setConfirmDelete]   = useState<DeleteKind | null>(null)
  const [search,          setSearch]          = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)

  const [fNomFr, setFNomFr] = useState('')
  const [fNomAr, setFNomAr] = useState('')
  const [fCode,  setFCode]  = useState('')   // ref UE
  const [fColor, setFColor] = useState('')   // couleur UE
  const [fRef,   setFRef]   = useState('')   // ref module / cours

  // Synchroniser si les props changent (après router.refresh())
  useEffect(() => { setOrderedUEs(ues) }, [ues])

  // Auto-expand/collapse selon la recherche
  useEffect(() => {
    if (!search.trim()) {
      setExpandedUEs(new Set())
      setExpandedModules(new Set())
      return
    }
    const q = search.toLowerCase()
    const matchingUEIds = new Set(
      ues.filter(ue => {
        if (ue.nom_fr.toLowerCase().includes(q)) return true
        if (ue.nom_ar?.toLowerCase().includes(q)) return true
        if (ue.code?.toLowerCase().includes(q)) return true
        const ueMods = modules.filter(m => m.unite_enseignement_id === ue.id)
        if (ueMods.some(m => m.nom_fr.toLowerCase().includes(q) || m.nom_ar?.toLowerCase().includes(q))) return true
        const ueCours = cours.filter(c => c.unite_enseignement_id === ue.id)
        if (ueCours.some(c => c.nom_fr.toLowerCase().includes(q) || c.nom_ar?.toLowerCase().includes(q))) return true
        return false
      }).map(ue => ue.id)
    )
    const matchingModuleIds = new Set(
      modules.filter(mod =>
        cours.some(c => c.module_id === mod.id &&
          (c.nom_fr.toLowerCase().includes(q) || c.nom_ar?.toLowerCase().includes(q)))
      ).map(mod => mod.id)
    )
    setExpandedUEs(matchingUEIds)
    setExpandedModules(matchingModuleIds)
  }, [search, ues, modules, cours])

  // ── DnD ───────────────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedUEs.findIndex(u => u.id === active.id)
    const newIndex = orderedUEs.findIndex(u => u.id === over.id)
    const reordered = arrayMove(orderedUEs, oldIndex, newIndex)
    setOrderedUEs(reordered)

    const supabase = createClient()
    await Promise.all(
      reordered.map((ue, i) =>
        supabase.from('unites_enseignement').update({ order_index: i }).eq('id', ue.id)
      )
    )
  }

  // ── Helpers expand ────────────────────────────────────────────────────────

  const toggleUE = (id: string) =>
    setExpandedUEs(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  const toggleModule = (id: string) =>
    setExpandedModules(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  // ── Helpers formulaire ────────────────────────────────────────────────────

  const openAdd = (a: AddingKind) => {
    setAdding(a); setEditing(null); setError(null)
    setFNomFr(''); setFNomAr(''); setFCode(''); setFRef('')
    // Auto-suggest color for new UE
    if (a.kind === 'ue') {
      const usedColors = new Set(ues.map(u => u.color).filter(Boolean))
      const nextColor = UE_COLOR_PALETTE.find(c => !usedColors.has(c)) ?? UE_COLOR_PALETTE[0]
      setFColor(nextColor)
    } else {
      setFColor('')
    }
  }

  const openEdit = (e: EditingKind) => {
    setEditing(e); setAdding(null); setError(null)
    if (e.kind === 'ue')     {
      setFNomFr(e.item.nom_fr); setFNomAr(e.item.nom_ar ?? ''); setFCode(e.item.code ?? '')
      // Si pas de couleur, en suggerer une non prise
      if (e.item.color) {
        setFColor(e.item.color)
      } else {
        const usedColors = new Set(ues.filter(u => u.id !== e.item.id).map(u => u.color).filter(Boolean))
        setFColor(UE_COLOR_PALETTE.find(c => !usedColors.has(c)) ?? UE_COLOR_PALETTE[0])
      }
    }
    if (e.kind === 'module') { setFNomFr(e.item.nom_fr); setFNomAr(e.item.nom_ar ?? ''); setFRef(e.item.code ?? '') }
    if (e.kind === 'cours')  { setFNomFr(e.item.nom_fr); setFNomAr(e.item.nom_ar ?? ''); setFRef(e.item.code ?? '') }
  }

  const cancel = () => { setAdding(null); setEditing(null); setError(null) }

  // ── Supabase ──────────────────────────────────────────────────────────────

  const UE_COLOR_PALETTE = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
    '#84CC16', '#A855F7', '#0EA5E9', '#D946EF', '#78716C',
  ]

  const refreshAndReset = () => {
    router.refresh()
    setAdding(null); setEditing(null)
    setFNomFr(''); setFNomAr(''); setFCode(''); setFColor(''); setFRef('')
    setSubmitting(false)
  }

  const handleAddUE = async () => {
    if (!fNomFr.trim()) return
    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('unites_enseignement').insert({
      etablissement_id: etablissementId,
      nom_fr:           fNomFr.trim(),
      nom_ar:           fNomAr.trim() || null,
      code:             fCode.trim() || null,
      color:            fColor.trim() || null,
    })
    if (error) { setError(error.message); setSubmitting(false); return }
    refreshAndReset()
  }

  const handleAddModule = async (ueId: string) => {
    if (!fNomFr.trim()) return
    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('cours_modules').insert({
      unite_enseignement_id: ueId,
      nom_fr:                fNomFr.trim(),
      nom_ar:                fNomAr.trim() || null,
      code:                  fRef.trim() || null,
    })
    if (error) { setError(error.message); setSubmitting(false); return }
    setExpandedUEs(prev => new Set([...prev, ueId]))
    refreshAndReset()
  }

  const handleAddCours = async (ueId: string, moduleId: string | null) => {
    if (!fNomFr.trim()) return
    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('cours').insert({
      unite_enseignement_id: ueId,
      module_id:             moduleId,
      nom_fr:                fNomFr.trim(),
      nom_ar:                fNomAr.trim() || null,
      code:                  fRef.trim() || null,
    })
    if (error) { setError(error.message); setSubmitting(false); return }
    if (moduleId) setExpandedModules(prev => new Set([...prev, moduleId]))
    setExpandedUEs(prev => new Set([...prev, ueId]))
    refreshAndReset()
  }

  const handleEditUE = async (id: string) => {
    if (!fNomFr.trim()) return
    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('unites_enseignement')
      .update({ nom_fr: fNomFr.trim(), nom_ar: fNomAr.trim() || null, code: fCode.trim() || null, color: fColor.trim() || null })
      .eq('id', id)
    if (error) { setError(error.message); setSubmitting(false); return }
    refreshAndReset()
  }

  const handleEditModule = async (id: string) => {
    if (!fNomFr.trim()) return
    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('cours_modules')
      .update({ nom_fr: fNomFr.trim(), nom_ar: fNomAr.trim() || null, code: fRef.trim() || null })
      .eq('id', id)
    if (error) { setError(error.message); setSubmitting(false); return }
    refreshAndReset()
  }

  const handleEditCours = async (id: string) => {
    if (!fNomFr.trim()) return
    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('cours')
      .update({ nom_fr: fNomFr.trim(), nom_ar: fNomAr.trim() || null, code: fRef.trim() || null })
      .eq('id', id)
    if (error) { setError(error.message); setSubmitting(false); return }
    refreshAndReset()
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setSubmitting(true); setDeleteError(null)
    const supabase = createClient()

    let error: { code?: string; message: string } | null = null

    if (confirmDelete.kind === 'ue') {
      const res = await supabase.from('unites_enseignement').delete().eq('id', confirmDelete.id)
      error = res.error
    } else if (confirmDelete.kind === 'module') {
      const res = await supabase.from('cours_modules').delete().eq('id', confirmDelete.id)
      error = res.error
    } else {
      const res = await supabase.from('cours').delete().eq('id', confirmDelete.id)
      error = res.error
    }

    if (error) {
      const msg = error.code === '23503'
        ? 'Impossible de supprimer : des cours sont rattachés à cet élément.'
        : error.message
      setDeleteError(msg)
      setSubmitting(false)
      return
    }
    setConfirmDelete(null)
    setDeleteError(null)
    setSubmitting(false)
    router.refresh()
  }

  // ── Filtrage ──────────────────────────────────────────────────────────────

  const q = search.toLowerCase()

  const filteredUEs = orderedUEs.filter(ue => {
    if (!q) return true
    if (ue.nom_fr.toLowerCase().includes(q)) return true
    if (ue.nom_ar?.toLowerCase().includes(q)) return true
    if (ue.code?.toLowerCase().includes(q)) return true
    const ueModules = modules.filter(m => m.unite_enseignement_id === ue.id)
    if (ueModules.some(m => m.nom_fr.toLowerCase().includes(q) || m.nom_ar?.toLowerCase().includes(q))) return true
    const ueCours = cours.filter(c => c.unite_enseignement_id === ue.id)
    if (ueCours.some(c => c.nom_fr.toLowerCase().includes(q) || c.nom_ar?.toLowerCase().includes(q))) return true
    return false
  })

  // ── Définition des champs de formulaire ───────────────────────────────────

  // UE : Réf réduit (80px), Nom FR élastique, Nom AR élastique, Couleur
  const ueFields: FieldDef[] = [
    { label: 'Réf',      value: fCode,  onChange: setFCode,  maxWidth: '80px' },
    { label: 'Nom (FR)', value: fNomFr, onChange: setFNomFr },
    { label: 'Nom (AR)', value: fNomAr, onChange: setFNomAr, dir: 'auto' },
    { label: 'Couleur',  value: fColor, onChange: setFColor, type: 'color', maxWidth: '60px' },
  ]
  // Module : Réf réduit, Nom FR, Nom AR
  const moduleFields: FieldDef[] = [
    { label: 'Réf',      value: fRef,   onChange: setFRef,   maxWidth: '80px' },
    { label: 'Nom (FR)', value: fNomFr, onChange: setFNomFr },
    { label: 'Nom (AR)', value: fNomAr, onChange: setFNomAr, dir: 'auto' },
  ]
  // Cours : Réf réduit, Nom FR, Nom AR
  const coursFields: FieldDef[] = [
    { label: 'Réf',      value: fRef,   onChange: setFRef,   maxWidth: '80px' },
    { label: 'Nom (FR)', value: fNomFr, onChange: setFNomFr },
    { label: 'Nom (AR)', value: fNomAr, onChange: setFNomAr, dir: 'auto' },
  ]

  // Props partagées pour toutes les cartes UE
  const shared: SharedCardProps = {
    modules, cours, expandedUEs, expandedModules, adding, editing,
    error, submitting,
    fNomFr, fNomAr, fRef,
    setFNomFr, setFNomAr, setFRef,
    ueFields, moduleFields, coursFields,
    toggleUE, toggleModule, openEdit, openAdd, cancel,
    setConfirmDelete, setDeleteError,
    handleEditUE, handleEditModule, handleEditCours,
    handleAddModule, handleAddCours,
    search,
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">

      {/* Barre de recherche + bouton nouvelle UE */}
      <div className="flex items-center justify-end gap-3">
        <div className="relative w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none" />
          <input
            type="text"
            dir="auto"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="input pl-9 pr-7 text-sm py-2 w-full"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600 transition-colors"
              title="Effacer"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => openAdd({ kind: 'ue' })}
          className="btn btn-primary text-sm py-2 flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus size={15} /> Nouvelle UE
        </button>
      </div>

      {/* Formulaire ajout UE */}
      {adding?.kind === 'ue' && (
        <div className="card p-3 mt-4">
          <p className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">Nouvelle Unité d&apos;Enseignement</p>
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <InlineForm fields={ueFields} onSubmit={handleAddUE} onCancel={cancel} submitting={submitting} />
        </div>
      )}

      {/* État vide */}
      {filteredUEs.length === 0 && (
        <div className="card p-12 text-center text-warm-400 mt-4">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {search ? 'Aucun résultat' : 'Aucune unité d\'enseignement configurée'}
          </p>
          {!search && (
            <p className="text-xs mt-1">Cliquez sur &ldquo;+ Nouvelle UE&rdquo; pour commencer.</p>
          )}
        </div>
      )}

      {/* Arbre avec DnD */}
      <div className="mt-4 space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredUEs.map(u => u.id)} strategy={verticalListSortingStrategy}>
            {filteredUEs.map(ue => (
              <SortableUECard key={ue.id} ue={ue} shared={shared} />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
            <div className="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 className="font-bold text-secondary-800">Confirmer la suppression</h3>
              <button
                type="button"
                onClick={() => { setConfirmDelete(null); setDeleteError(null) }}
                className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 pt-2 pb-6">
            <p className="text-sm text-warm-500 mb-1">
              Supprimer <span dir="auto" className="font-semibold text-secondary-700">&ldquo;{confirmDelete.nom}&rdquo;</span> ?
            </p>
            {confirmDelete.kind !== 'cours' && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                Attention : tous les éléments rattachés seront également supprimés.
              </p>
            )}
            {deleteError && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-3">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setConfirmDelete(null); setDeleteError(null) }} className="btn btn-secondary text-sm" disabled={submitting}>
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={submitting}
                className={clsx('btn text-sm bg-danger-500 text-white hover:bg-danger-600', submitting && 'opacity-50 cursor-not-allowed')}
              >
                {submitting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
