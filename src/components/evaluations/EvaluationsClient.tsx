'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Check, X, Pencil, Trash2,
  Search, ChevronUp, ChevronRight, ChevronDown, BookOpen,
} from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type {
  UniteEnseignement, CoursModule, Cours,
  Period, EvalTypeConfig, EvalTypeKind,
} from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string
  name: string
  level: string
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  main_teacher_name: string | null
  main_teacher_civilite: string | null
}

type EvaluationRow = {
  id: string
  class_id: string
  period_id: string | null
  cours_id: string | null
  eval_kind: string | null
  max_score: number | null
  coefficient: number
  evaluation_date: string | null
  display_module_id: string | null
  display_ue_id: string | null
  sort_order: number | null
}

type EvalOrderConfig = {
  class_id:     string
  period_id:    string
  ue_order:     string[]
  module_order: Record<string, string[]>
}

type EvalOption = {
  configId: string
  label: string
  evalKind: EvalTypeKind
  maxScore: number | null
}

interface Props {
  classes:            ClassRow[]
  periods:            Period[]
  evalTypeConfigs:    EvalTypeConfig[]
  ues:                UniteEnseignement[]
  modules:            CoursModule[]
  cours:              Cours[]
  initialEvaluations: EvaluationRow[]
  evalOrderConfigs:   EvalOrderConfig[]
  etablissementId:    string
  schoolYearId:       string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  S1: 'Semestre 1',
  S2: 'Semestre 2',
  T1: 'Trimestre 1',
  T2: 'Trimestre 2',
  T3: 'Trimestre 3',
}
function formatPeriodLabel(label: string): string {
  return PERIOD_LABELS[label] ?? label
}

function evalOptionLabel(c: EvalTypeConfig): string {
  if (c.eval_type === 'scored')     return `Notée /${c.max_score}`
  if (c.eval_type === 'diagnostic') return 'Diagnostique'
  return 'Étoilée ★'
}

const EVAL_BADGE: Record<string, { label: string; cls: string }> = {
  diagnostic: { label: 'Diagnostique', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  scored:     { label: 'Notée',        cls: 'bg-green-50 text-green-700 border-green-200' },
  stars:      { label: 'Étoilée ★',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
}

// ─── Sous-composant : ligne cours dans le référentiel gauche ──────────────────

function CoursRefRow({
  c, isMarked, disabled, onAdd,
}: {
  c: Cours; isMarked: boolean; disabled: boolean; onAdd: () => void
}) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null)

  const handleMouseEnter = (e: React.MouseEvent) => {
    const el = spanRef.current
    if (el && el.scrollWidth > el.clientWidth) {
      setTooltip({ x: e.clientX, y: e.clientY })
    }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (tooltip) setTooltip({ x: e.clientX, y: e.clientY })
  }
  const handleMouseLeave = () => setTooltip(null)

  return (
    <div className="flex items-center gap-1.5 py-0.5 px-1 rounded group hover:bg-primary-50 transition-colors">
      <span className="w-1 h-1 rounded-full bg-warm-300 flex-shrink-0" />
      {c.code && (
        <span className="text-[10px] font-mono text-warm-400 bg-warm-100 px-1 rounded flex-shrink-0">{c.code}</span>
      )}
      <span
        ref={spanRef}
        className="flex-1 text-xs text-secondary-700 truncate"
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {c.nom_fr}
      </span>
      {isMarked ? (
        <Check size={12} className="text-primary-500 flex-shrink-0" />
      ) : (
        <button
          onClick={onAdd}
          disabled={disabled}
          className="p-0.5 text-warm-300 hover:text-primary-600 rounded transition-colors disabled:opacity-30"
          title="Ajouter une évaluation"
        >
          <Plus size={13} />
        </button>
      )}
      {tooltip && createPortal(
        <div
          className="fixed z-50 px-2 py-1 text-xs text-white bg-secondary-800 rounded shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: tooltip.x + 12, top: tooltip.y - 28 }}
        >
          {c.nom_fr}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Formulaire inline ────────────────────────────────────────────────────────

function InlineEvalForm({
  evalOptions, configId, setConfigId,
  coefficient, setCoefficient,
  date, setDate,
  onSave, onCancel, submitting,
}: {
  evalOptions:    EvalOption[]
  configId:       string
  setConfigId:    (v: string) => void
  coefficient:    string
  setCoefficient: (v: string) => void
  date:           string
  setDate:        (v: string) => void
  onSave:         () => void
  onCancel:       () => void
  submitting:     boolean
}) {
  const selectedKind = evalOptions.find(o => o.configId === configId)?.evalKind
  const isScored = selectedKind === 'scored'

  return (
    <div className="flex flex-wrap items-end gap-2 py-2 px-3 bg-warm-50 rounded-lg border border-warm-200 mt-1">
      {/* Type */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold text-warm-400 uppercase tracking-wide">Type</label>
        <select
          value={configId}
          onChange={e => setConfigId(e.target.value)}
          className="input text-sm py-1 pr-7"
          disabled={submitting}
        >
          {evalOptions.map(o => (
            <option key={o.configId} value={o.configId}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Coefficient — uniquement pour les évaluations notées */}
      {isScored && (
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] font-semibold text-warm-400 uppercase tracking-wide">Coef.</label>
          <input
            type="number"
            value={coefficient}
            onChange={e => setCoefficient(e.target.value)}
            min="0.5"
            step="0.5"
            className="input text-sm py-1 w-20"
            disabled={submitting}
          />
        </div>
      )}

      {/* Date */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-semibold text-warm-400 uppercase tracking-wide">Date (optionnelle)</label>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="input text-sm py-1"
          disabled={submitting}
        />
      </div>

      <button onClick={onSave} disabled={submitting} className="btn btn-primary py-1 px-3 text-sm self-end">
        <Check size={14} />
      </button>
      <button onClick={onCancel} disabled={submitting} className="btn btn-secondary py-1 px-3 text-sm self-end">
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function EvaluationsClient({
  classes, periods, evalTypeConfigs, ues, modules, cours,
  initialEvaluations, evalOrderConfigs, etablissementId, schoolYearId,
}: Props) {
  // ── Sélecteurs ──────────────────────────────────────────────────────────────
  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes[0]?.id ?? null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(periods[0]?.id ?? null)

  // ── Formulaire ──────────────────────────────────────────────────────────────
  const [adding,          setAdding]          = useState<string | null>(null)   // cours_id
  const [editing,         setEditing]         = useState<string | null>(null)   // eval id
  const [confirmDelete,   setConfirmDelete]   = useState<string | null>(null)   // eval id
  const [formConfigId,    setFormConfigId]    = useState('')
  const [formCoefficient, setFormCoefficient] = useState('1')
  const [formDate,        setFormDate]        = useState('')
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  // ── Référentiel search ───────────────────────────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [expandedUEs,  setExpandedUEs]  = useState<Set<string>>(new Set())

  // ── Évaluations locales ──────────────────────────────────────────────────────
  const [evalsList,    setEvalsList]    = useState<EvaluationRow[]>(initialEvaluations)
  const [moduleOrder,  setModuleOrder]  = useState<Record<string, string[]>>({})
  const [ueOrder,      setUeOrder]      = useState<string[]>([])
  const [orderDirty,   setOrderDirty]   = useState(false)
  const [savingOrder,  setSavingOrder]  = useState(false)

  // Charger la config d'ordre propre à la classe × période sélectionnée
  useEffect(() => {
    const config = evalOrderConfigs.find(
      c => c.class_id === selectedClassId && c.period_id === selectedPeriodId
    )
    setUeOrder(config?.ue_order ?? [])
    setModuleOrder((config?.module_order ?? {}) as Record<string, string[]>)
    setOrderDirty(false)
  }, [selectedClassId, selectedPeriodId]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Options du select type ───────────────────────────────────────────────────
  const evalOptions: EvalOption[] = useMemo(() =>
    evalTypeConfigs
      .filter(c => c.is_active)
      .map(c => ({
        configId: c.id,
        label:    evalOptionLabel(c),
        evalKind: c.eval_type,
        maxScore: c.max_score ?? null,
      })),
    [evalTypeConfigs]
  )

  // ── Évaluations de la classe+période sélectionnée ───────────────────────────
  const currentEvals = useMemo(() =>
    evalsList.filter(e =>
      e.class_id === selectedClassId &&
      e.period_id === selectedPeriodId
    ),
    [evalsList, selectedClassId, selectedPeriodId]
  )

  const evaluatedCoursIds = useMemo(() =>
    new Set(currentEvals.map(e => e.cours_id).filter(Boolean) as string[]),
    [currentEvals]
  )

  // ── Filtrage référentiel ─────────────────────────────────────────────────────
  const q = search.toLowerCase().trim()
  const filteredUes = useMemo(() => {
    if (!q) return ues
    return ues.filter(ue => {
      if (ue.nom_fr.toLowerCase().includes(q)) return true
      if (ue.code?.toLowerCase().includes(q)) return true
      return cours.some(c =>
        c.unite_enseignement_id === ue.id &&
        (c.nom_fr.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q))
      )
    })
  }, [ues, cours, q])

  const toggleUE = (id: string) =>
    setExpandedUEs(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })

  // ── UEs du panneau droit ─────────────────────────────────────────────────────
  const rightUEIds = useMemo(() => {
    const ids = new Set<string>()
    currentEvals.forEach(e => {
      const ueId = e.display_ue_id ?? cours.find(c => c.id === e.cours_id)?.unite_enseignement_id
      if (ueId) ids.add(ueId)
    })
    if (adding) {
      const c = cours.find(c => c.id === adding)
      if (c) ids.add(c.unite_enseignement_id)
    }
    return ids
  }, [currentEvals, cours, adding])

  const rightUEs = useMemo(() => {
    const natural = ues.filter(ue => rightUEIds.has(ue.id))
    if (ueOrder.length === 0) return natural
    const known   = ueOrder.filter(id => rightUEIds.has(id)).map(id => ues.find(u => u.id === id)).filter((u): u is UniteEnseignement => Boolean(u))
    const newOnes = natural.filter(ue => !ueOrder.includes(ue.id))
    return [...known, ...newOnes]
  }, [ues, rightUEIds, ueOrder])

  // ── Helpers formulaire ───────────────────────────────────────────────────────
  const getOption = () => evalOptions.find(o => o.configId === formConfigId)

  const openAdd = (coursId: string) => {
    setAdding(coursId); setEditing(null); setConfirmDelete(null)
    setFormConfigId(evalOptions[0]?.configId ?? '')
    setFormCoefficient('1'); setFormDate(''); setError(null)
  }

  const openEdit = async (ev: EvaluationRow) => {
    setError(null)
    const supabase = createClient()
    const { count } = await supabase
      .from('grades')
      .select('id', { count: 'exact', head: true })
      .eq('evaluation_id', ev.id)
    if ((count ?? 0) > 0) {
      setError('Impossible de modifier cette évaluation : des notes ont déjà été saisies.')
      return
    }
    setEditing(ev.id); setAdding(null); setConfirmDelete(null)
    const config = evalTypeConfigs.find(c =>
      c.eval_type === ev.eval_kind &&
      (ev.eval_kind !== 'scored' || c.max_score === ev.max_score)
    )
    setFormConfigId(config?.id ?? evalOptions[0]?.configId ?? '')
    setFormCoefficient(String(ev.coefficient ?? 1))
    setFormDate(ev.evaluation_date ?? '')
  }

  const cancelForm = () => { setAdding(null); setEditing(null); setError(null) }

  // ── Supabase handlers ────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!adding || !selectedClassId || !selectedPeriodId || !formConfigId) return
    const option    = getOption(); if (!option) return
    const coursItem = cours.find(c => c.id === adding); if (!coursItem) return

    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('evaluations')
      .insert({
        etablissement_id:  etablissementId,
        class_id:          selectedClassId,
        period_id:         selectedPeriodId,
        cours_id:          adding,
        eval_kind:         option.evalKind,
        max_score:         option.maxScore,
        coefficient:       option.evalKind === 'scored' ? (parseFloat(formCoefficient) || 1) : 1,
        evaluation_date:   formDate || null,
        title:             coursItem.nom_fr,
        display_ue_id:     coursItem.unite_enseignement_id,
        display_module_id: coursItem.module_id ?? null,
      })
      .select('id, class_id, period_id, cours_id, eval_kind, max_score, coefficient, evaluation_date, display_module_id, display_ue_id, sort_order')
      .single()

    if (err) { setError(err.message); setSubmitting(false); return }
    setEvalsList(prev => [...prev, data as EvaluationRow])
    setOrderDirty(true)
    setAdding(null); setSubmitting(false)
  }

  const handleEdit = async () => {
    if (!editing || !formConfigId) return
    const option = getOption(); if (!option) return

    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('evaluations')
      .update({
        eval_kind:       option.evalKind,
        max_score:       option.maxScore,
        coefficient:     option.evalKind === 'scored' ? (parseFloat(formCoefficient) || 1) : 1,
        evaluation_date: formDate || null,
      })
      .eq('id', editing)

    if (err) { setError(err.message); setSubmitting(false); return }
    setEvalsList(prev => prev.map(e => e.id === editing
      ? { ...e, eval_kind: option.evalKind, max_score: option.maxScore, coefficient: option.evalKind === 'scored' ? (parseFloat(formCoefficient) || 1) : 1, evaluation_date: formDate || null }
      : e
    ))
    setEditing(null); setSubmitting(false)
  }

  const handleDelete = async (evalId: string) => {
    setSubmitting(true); setError(null)
    const supabase = createClient()
    const { count } = await supabase
      .from('grades')
      .select('id', { count: 'exact', head: true })
      .eq('evaluation_id', evalId)
    if ((count ?? 0) > 0) {
      setError('Impossible de supprimer cette évaluation : des notes ont déjà été saisies.')
      setSubmitting(false); setConfirmDelete(null); return
    }
    const { error: err } = await supabase.from('evaluations').delete().eq('id', evalId)
    if (err) { setError(err.message); setSubmitting(false); return }
    setEvalsList(prev => prev.filter(e => e.id !== evalId))
    setOrderDirty(true)
    setConfirmDelete(null); setSubmitting(false)
  }

  // ── Move up / down ───────────────────────────────────────────────────────────

  const moveEval = (evalId: string, dir: 'up' | 'down', siblings: EvaluationRow[]) => {
    const idx  = siblings.findIndex(e => e.id === evalId)
    const next = dir === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= siblings.length) return
    const swapId = siblings[next].id
    setEvalsList(prev => {
      const list = [...prev]
      const iA = list.findIndex(e => e.id === evalId)
      const iB = list.findIndex(e => e.id === swapId)
      ;[list[iA], list[iB]] = [list[iB], list[iA]]
      return list
    })
    setOrderDirty(true)
  }

  const moveModule = (ueId: string, modId: string, dir: 'up' | 'down', current: string[]) => {
    const idx  = current.indexOf(modId)
    const next = dir === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= current.length) return
    const arr = [...current]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setModuleOrder(prev => ({ ...prev, [ueId]: arr }))
    setOrderDirty(true)
  }

  const moveUE = (ueId: string, dir: 'up' | 'down', current: string[]) => {
    const idx  = current.indexOf(ueId)
    const next = dir === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= current.length) return
    const arr = [...current]
    ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
    setUeOrder(arr)
    setOrderDirty(true)
  }

  // ── Sauvegarde de l'ordre (propre à la classe × période) ─────────────────
  const handleSaveOrder = async () => {
    if (!selectedClassId || !selectedPeriodId) return
    setSavingOrder(true)
    setError(null)
    const supabase = createClient()
    try {
      // 1. Ordre des évaluations (sort_order par éval, déjà scoped class+période)
      await Promise.all(
        currentEvals.map((ev, idx) =>
          supabase.from('evaluations').update({ sort_order: idx }).eq('id', ev.id)
        )
      )
      // 2. Ordre des UEs et modules — stocké dans evaluation_order_config
      await supabase
        .from('evaluation_order_config')
        .upsert(
          {
            class_id:     selectedClassId,
            period_id:    selectedPeriodId,
            ue_order:     ueOrder,
            module_order: moduleOrder,
          },
          { onConflict: 'class_id,period_id' }
        )
      setOrderDirty(false)
    } catch {
      setError('Erreur lors de la sauvegarde de l\'ordre.')
    } finally {
      setSavingOrder(false)
    }
  }

  // ── Flags état ───────────────────────────────────────────────────────────────
  const noSchoolYear   = !schoolYearId
  const noClassOrPeriod = !selectedClassId || !selectedPeriodId
  const noEvalTypes    = evalOptions.length === 0

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-3 animate-fade-in">

      {/* ── Sélecteurs ── */}
      <div className="card p-3 flex flex-wrap items-center gap-4 flex-shrink-0">

        {/* Classe */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-warm-500 uppercase tracking-wide whitespace-nowrap">Classe</span>
          <select
            value={selectedClassId ?? ''}
            onChange={e => { setSelectedClassId(e.target.value || null); cancelForm() }}
            className="input text-sm py-1.5"
            disabled={classes.length === 0}
          >
            {classes.length === 0
              ? <option value="">Aucune classe disponible</option>
              : classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
            }
          </select>
        </div>

        {/* Onglets périodes */}
        {periods.length > 0 && (
          <div className="flex items-center gap-1">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPeriodId(p.id); cancelForm() }}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                  selectedPeriodId === p.id
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                )}
              >
                {formatPeriodLabel(p.label)}
              </button>
            ))}
          </div>
        )}

        {/* Alerte pas d'année scolaire */}
        {noSchoolYear && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            Aucune année scolaire active — configurez-en une dans Paramètres &gt; Année scolaire.
          </p>
        )}
        {!noSchoolYear && noEvalTypes && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            Aucun type d'évaluation configuré pour cette année scolaire.
          </p>
        )}

        {/* Infos classe — à droite */}
        {selectedClassId && (() => {
          const cls = classes.find(c => c.id === selectedClassId)
          if (!cls) return null
          const parts: string[] = []
          if (cls.main_teacher_name) {
            const display = cls.main_teacher_civilite
              ? `${cls.main_teacher_civilite} ${cls.main_teacher_name}`
              : cls.main_teacher_name
            parts.push(display)
          }
          if (cls.level) parts.push(`Niveau ${cls.level}`)
          const timeStr = [cls.start_time, cls.end_time].filter(Boolean).map(t => t!.slice(0, 5)).join('–')
          const schedule = [cls.day_of_week, timeStr].filter(Boolean).join(' ')
          if (schedule) parts.push(schedule)
          if (parts.length === 0) return null
          return (
            <span className="ml-auto text-sm font-medium text-warm-600 whitespace-nowrap">
              {parts.join(' · ')}
            </span>
          )
        })()}
      </div>

      {/* ── Panneau principal (split) ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* ── Gauche : Référentiel ── */}
        <div className="w-72 flex-shrink-0 flex flex-col min-h-0">
          <div className="card p-3 flex flex-col gap-2 h-full min-h-0">
            <p className="text-xs font-bold text-warm-500 uppercase tracking-widest flex-shrink-0">
              Référentiel des cours
            </p>

            {/* Recherche */}
            <div className="relative flex-shrink-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="input pl-8 text-sm py-1.5 w-full"
              />
            </div>

            {/* Arbre */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
              {filteredUes.length === 0 && (
                <p className="text-xs text-warm-400 text-center py-6">
                  {search ? 'Aucun résultat' : 'Référentiel vide'}
                </p>
              )}

              {filteredUes.map(ue => {
                const ueCours = cours.filter(c => c.unite_enseignement_id === ue.id)
                const ueMods  = modules.filter(m => m.unite_enseignement_id === ue.id)
                const expanded = expandedUEs.has(ue.id)
                const canAdd   = !noClassOrPeriod && !noSchoolYear && !noEvalTypes

                return (
                  <div key={ue.id} className="border border-warm-100 rounded-lg overflow-hidden">

                    {/* En-tête UE */}
                    <button
                      onClick={() => toggleUE(ue.id)}
                      className="flex items-center gap-1.5 w-full px-2 py-1.5 bg-warm-50 hover:bg-warm-100 transition-colors text-left"
                    >
                      {expanded
                        ? <ChevronDown  size={13} className="text-warm-400 flex-shrink-0" />
                        : <ChevronRight size={13} className="text-warm-400 flex-shrink-0" />
                      }
                      {ue.code && (
                        <span className="text-[10px] font-mono text-warm-400 bg-warm-200 px-1 rounded flex-shrink-0">
                          {ue.code}
                        </span>
                      )}
                      <span className="text-xs font-bold text-secondary-700 truncate">{ue.nom_fr}</span>
                    </button>

                    {/* Cours de l'UE */}
                    {expanded && (
                      <div className="py-1 space-y-px">

                        {/* Cours directs (sans module) */}
                        <div className="px-2">
                          {ueCours.filter(c => !c.module_id).map(c => (
                            <CoursRefRow
                              key={c.id} c={c}
                              isMarked={evaluatedCoursIds.has(c.id) || adding === c.id}
                              disabled={!canAdd}
                              onAdd={() => openAdd(c.id)}
                            />
                          ))}
                        </div>

                        {/* Modules + leurs cours */}
                        {ueMods.map(mod => {
                          const modCours = ueCours.filter(c => c.module_id === mod.id)
                          if (modCours.length === 0) return null
                          return (
                            <div key={mod.id} className="mt-0.5 ml-4">
                              <p className="flex items-center gap-1 text-[10px] font-semibold text-warm-400 uppercase tracking-wider pl-3 pr-2 pt-1.5 pb-0.5 border-l-2 border-warm-100">
                                {mod.code && <span className="font-mono">{mod.code}</span>}
                                {mod.nom_fr}
                              </p>
                              <div className="pl-6 pr-2">
                                {modCours.map(c => (
                                  <CoursRefRow
                                    key={c.id} c={c}
                                    isMarked={evaluatedCoursIds.has(c.id) || adding === c.id}
                                    disabled={!canAdd}
                                    onAdd={() => openAdd(c.id)}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Droite : Évaluations ── */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="card p-3 flex flex-col h-full min-h-0">

            {/* En-tête droite */}
            <div className="flex items-center gap-2 mb-2 flex-shrink-0">
              <p className="text-xs font-bold text-warm-500 uppercase tracking-widest flex-1">
                Évaluations
                {selectedClassId && selectedPeriodId && (() => {
                  const cls = classes.find(c => c.id === selectedClassId)
                  const per = periods.find(p => p.id === selectedPeriodId)
                  return <span className="normal-case font-normal ml-1 text-warm-400">— {cls?.name} · {per ? formatPeriodLabel(per.label) : ''}</span>
                })()}
              </p>
              {currentEvals.length > 0 && (
                <button
                  onClick={handleSaveOrder}
                  disabled={!orderDirty || savingOrder}
                  className="btn btn-primary text-xs py-1 px-3 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  title="Enregistrer l'ordre des évaluations, modules et UEs"
                >
                  <Check size={12} />
                  {savingOrder ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              )}
            </div>

            {/* Erreur globale */}
            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2 flex-shrink-0">
                {error}
              </p>
            )}

            {/* États vides */}
            {noSchoolYear && (
              <EmptyState message="Configurez une année scolaire pour commencer." />
            )}
            {!noSchoolYear && noClassOrPeriod && (
              <EmptyState message="Sélectionnez une classe et une période." />
            )}
            {!noSchoolYear && !noClassOrPeriod && currentEvals.length === 0 && !adding && (
              <EmptyState message="Aucune évaluation pour cette période. Cliquez sur + dans le référentiel pour en ajouter." />
            )}

            {/* Liste évaluations groupées par UE puis par module, avec drag & drop */}
            {!noSchoolYear && !noClassOrPeriod && (currentEvals.length > 0 || adding) && (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                {rightUEs.map((ue, ueIdx) => {
                  // Effective UE/module pour chaque eval (display override > naturel)
                  const getEffUeId  = (e: EvaluationRow) =>
                    e.display_ue_id ?? cours.find(c => c.id === e.cours_id)?.unite_enseignement_id ?? ''
                  const getEffModId = (e: EvaluationRow): string | null =>
                    e.display_ue_id !== null
                      ? e.display_module_id
                      : cours.find(c => c.id === e.cours_id)?.module_id ?? null

                  const ueEvals     = currentEvals.filter(e => getEffUeId(e) === ue.id)
                  const addingHere  = adding ? cours.find(c => c.id === adding)?.unite_enseignement_id === ue.id : false
                  const addingCours = adding ? cours.find(c => c.id === adding) : null
                  const directEvals = ueEvals.filter(e => getEffModId(e) === null)

                  // Modules effectifs présents dans cette UE
                  // + le module du cours en cours d'ajout (même s'il n'a pas encore d'évals)
                  const naturalModIds = [...new Set([
                    ...ueEvals.map(e => getEffModId(e)).filter((id): id is string => id !== null),
                    ...(addingHere && addingCours?.module_id ? [addingCours.module_id] : []),
                  ])]
                  const savedOrder = moduleOrder[ue.id]
                  const modIds = savedOrder
                    ? [...savedOrder.filter(id => naturalModIds.includes(id)), ...naturalModIds.filter(id => !savedOrder.includes(id))]
                    : naturalModIds
                  const ueMods = modIds
                    .map(id => modules.find(m => m.id === id))
                    .filter((m): m is CoursModule => Boolean(m))

                  const renderEval = (ev: EvaluationRow, siblings: EvaluationRow[]) => {
                    const coursItem  = cours.find(c => c.id === ev.cours_id)
                    const badge      = EVAL_BADGE[ev.eval_kind ?? ''] ?? EVAL_BADGE.diagnostic
                    const isEditing  = editing === ev.id
                    const isDeleting = confirmDelete === ev.id

                    if (isEditing) {
                      return (
                        <div key={ev.id} className="px-1">
                          <p className="text-xs font-medium text-secondary-700 mb-1">
                            {coursItem?.code && (
                              <span className="font-mono text-[10px] text-warm-400 mr-1.5 bg-warm-100 px-1 py-px rounded">
                                {coursItem.code}
                              </span>
                            )}
                            {coursItem?.nom_fr}
                          </p>
                          <InlineEvalForm
                            evalOptions={evalOptions}
                            configId={formConfigId}       setConfigId={setFormConfigId}
                            coefficient={formCoefficient} setCoefficient={setFormCoefficient}
                            date={formDate}               setDate={setFormDate}
                            onSave={handleEdit}           onCancel={cancelForm}
                            submitting={submitting}
                          />
                        </div>
                      )
                    }

                    const sibIdx = siblings.findIndex(e => e.id === ev.id)

                    return (
                      <div
                        key={ev.id}
                        className="flex items-center gap-1 px-2 py-px rounded-lg hover:bg-warm-50 group transition-colors"
                      >
                        <div className="flex items-center flex-shrink-0">
                          {sibIdx > 0 && (
                            <button
                              onClick={() => moveEval(ev.id, 'up', siblings)}
                              className="p-0.5 text-secondary-400 hover:text-secondary-700 rounded transition-colors"
                              title="Monter"
                            >
                              <ChevronUp size={15} />
                            </button>
                          )}
                          {sibIdx < siblings.length - 1 && (
                            <button
                              onClick={() => moveEval(ev.id, 'down', siblings)}
                              className="p-0.5 text-secondary-400 hover:text-secondary-700 rounded transition-colors"
                              title="Descendre"
                            >
                              <ChevronDown size={15} />
                            </button>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {coursItem?.code && (
                            <span className="font-mono text-[10px] text-warm-400 mr-1.5 bg-warm-100 px-1 py-px rounded">
                              {coursItem.code}
                            </span>
                          )}
                          <span className="text-xs text-secondary-700">{coursItem?.nom_fr ?? '—'}</span>
                          {coursItem?.nom_ar && (
                            <span className="text-xs text-warm-400 ml-2">{coursItem.nom_ar}</span>
                          )}
                        </div>
                        <span className={clsx(
                          'text-[10px] font-semibold border px-1.5 py-px rounded-full whitespace-nowrap flex-shrink-0',
                          badge.cls
                        )}>
                          {badge.label}
                          {ev.eval_kind === 'scored' && ev.max_score != null && (
                            <span> /{ev.max_score}</span>
                          )}
                        </span>
                        <span className="text-xs text-warm-500 flex-shrink-0 font-mono">×{ev.coefficient}</span>
                        {ev.evaluation_date && (
                          <span className="text-xs text-warm-400 flex-shrink-0 font-mono">
                            {new Date(ev.evaluation_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                        {isDeleting ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-xs text-warm-500">Supprimer ?</span>
                            <button
                              onClick={() => handleDelete(ev.id)}
                              disabled={submitting}
                              className="text-xs font-medium px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              Oui
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs font-medium px-2 py-0.5 bg-warm-100 text-warm-600 rounded hover:bg-warm-200 transition-colors"
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => openEdit(ev)}
                              className="p-1 text-warm-400 hover:text-primary-600 rounded transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => { setConfirmDelete(ev.id); setAdding(null); setEditing(null) }}
                              className="p-1 text-warm-400 hover:text-danger-500 rounded transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  }

                  const renderAddForm = (c: Cours) => (
                    <div className="px-1">
                      <p className="text-xs font-medium text-secondary-700 mb-1">
                        {c.code && (
                          <span className="font-mono text-[10px] text-warm-400 mr-1.5 bg-warm-100 px-1 py-px rounded">
                            {c.code}
                          </span>
                        )}
                        {c.nom_fr}
                      </p>
                      <InlineEvalForm
                        evalOptions={evalOptions}
                        configId={formConfigId}       setConfigId={setFormConfigId}
                        coefficient={formCoefficient} setCoefficient={setFormCoefficient}
                        date={formDate}               setDate={setFormDate}
                        onSave={handleAdd}            onCancel={cancelForm}
                        submitting={submitting}
                      />
                    </div>
                  )

                  return (
                    <div key={ue.id}>
                      {/* En-tête UE */}
                      <div className="flex items-center gap-1 text-xs font-bold text-secondary-600 uppercase tracking-wide mb-1.5 px-1 border-b border-warm-100 pb-1">
                        <div className="flex items-center flex-shrink-0">
                          {ueIdx > 0 && (
                            <button
                              onClick={() => moveUE(ue.id, 'up', rightUEs.map(u => u.id))}
                              className="p-0.5 text-secondary-400 hover:text-secondary-700 rounded transition-colors"
                              title="Monter l'UE"
                            >
                              <ChevronUp size={14} />
                            </button>
                          )}
                          {ueIdx < rightUEs.length - 1 && (
                            <button
                              onClick={() => moveUE(ue.id, 'down', rightUEs.map(u => u.id))}
                              className="p-0.5 text-secondary-400 hover:text-secondary-700 rounded transition-colors"
                              title="Descendre l'UE"
                            >
                              <ChevronDown size={14} />
                            </button>
                          )}
                        </div>
                        <span className="flex-1">
                          {ue.code && (
                            <span className="font-mono text-warm-400 mr-1.5 normal-case">[{ue.code}]</span>
                          )}
                          {ue.nom_fr}
                          {ue.nom_ar && (
                            <span className="font-normal normal-case text-warm-400 ml-2">{ue.nom_ar}</span>
                          )}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {/* Zone "sans module" */}
                        <div>
                          {directEvals.map(ev => renderEval(ev, directEvals))}
                          {addingHere && addingCours && !addingCours.module_id && renderAddForm(addingCours)}
                        </div>

                        {/* Modules avec leurs évaluations */}
                        {ueMods.map(mod => {
                          const modEvals    = ueEvals.filter(e => getEffModId(e) === mod.id)
                          const addingInMod = addingHere && addingCours?.module_id === mod.id

                          return (
                            <div key={mod.id} className="mt-1.5 ml-4 rounded-lg">
                              {/* En-tête module */}
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-warm-400 uppercase tracking-wider px-2 pb-0.5 pt-1">
                                <div className="flex items-center flex-shrink-0">
                                  {modIds.indexOf(mod.id) > 0 && (
                                    <button
                                      onClick={() => moveModule(ue.id, mod.id, 'up', modIds)}
                                      className="p-0.5 text-secondary-400 hover:text-secondary-700 rounded transition-colors"
                                      title="Monter le module"
                                    >
                                      <ChevronUp size={14} />
                                    </button>
                                  )}
                                  {modIds.indexOf(mod.id) < modIds.length - 1 && (
                                    <button
                                      onClick={() => moveModule(ue.id, mod.id, 'down', modIds)}
                                      className="p-0.5 text-secondary-400 hover:text-secondary-700 rounded transition-colors"
                                      title="Descendre le module"
                                    >
                                      <ChevronDown size={14} />
                                    </button>
                                  )}
                                </div>
                                <span className="flex-1">
                                  {mod.code && <span className="font-mono">{mod.code}</span>}
                                  {mod.nom_fr}
                                  {mod.nom_ar && (
                                    <span className="normal-case font-normal text-warm-300 ml-2">{mod.nom_ar}</span>
                                  )}
                                </span>
                              </div>
                              <div className="pl-4">
                                {modEvals.map(ev => renderEval(ev, modEvals))}
                                {addingInMod && addingCours && renderAddForm(addingCours)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── État vide ────────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center text-center">
      <div className="text-warm-400">
        <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm max-w-xs">{message}</p>
      </div>
    </div>
  )
}
