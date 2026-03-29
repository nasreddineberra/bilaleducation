'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, Clock, Plus, Trash2, Paperclip, X, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { WarningSeverity } from '@/types/database'
import { FloatSelect, FloatInput, FloatTextarea, FloatButton } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

type AbsenceRow = {
  id: string
  class_id: string
  period_id: string
  absence_date: string
  absence_type: 'absence' | 'retard'
  comment: string | null
  is_justified: boolean
}

type WarningRow = {
  id: string
  class_id: string
  period_id: string
  warning_date: string
  severity: WarningSeverity
  motif: string
  issued_by: string | null
  created_at: string
  attachments: { id: string; file_url: string; file_name: string }[]
}

type PeriodRow = {
  id: string
  label: string
  order_index: number
  school_years?: { label: string } | null
}

type EnrollmentRow = {
  class_id: string
  classes: { name: string } | null
}

interface Props {
  studentId: string
  etablissementId: string
  absences: AbsenceRow[]
  warnings: WarningRow[]
  periods: PeriodRow[]
  enrollments: EnrollmentRow[]
  currentYearLabel: string
}

// ─── Descriptions des types de gravité ──────────────────────────────────────

const SEVERITY_CONFIG: Record<WarningSeverity, { label: string; color: string; description: string }> = {
  punition: {
    label: 'Punition',
    color: 'bg-amber-100 text-amber-800',
    description: 'Mesure prise en cas de manquement mineur aux obligations ou de comportement perturbateur.',
  },
  prevention: {
    label: 'Mesure de prévention',
    color: 'bg-blue-100 text-blue-800',
    description: 'Mesure visant à éviter qu\'un acte dangereux se produise, prévue par le règlement intérieur (ex : confiscation d\'un objet dangereux ou interdit).',
  },
  conservatoire: {
    label: 'Mesure conservatoire',
    color: 'bg-orange-100 text-orange-800',
    description: 'Mesure garantissant l\'ordre dans l\'établissement en cas de procédure disciplinaire engagée. L\'accès à l\'établissement peut être interdit pendant 2 jours ouvrables minimum ou jusqu\'à la date du conseil de discipline. Non inscrite au dossier scolaire.',
  },
  sanction: {
    label: 'Sanction',
    color: 'bg-red-100 text-red-800',
    description: 'Mesure prise en cas de manquement grave ou répété aux obligations : atteintes aux personnes (violences verbales ou physiques) ou aux biens (dégradation, destruction de matériel). Individuelle uniquement, prévue par le règlement intérieur.',
  },
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function StudentDiscipline({
  studentId, etablissementId, absences: initialAbsences, warnings: initialWarnings, periods, enrollments, currentYearLabel,
}: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filtrer par année en cours
  const currentPeriodIds = useMemo(() => {
    const ids = new Set<string>()
    for (const p of periods) {
      if ((p.school_years as any)?.label === currentYearLabel) ids.add(p.id)
    }
    return ids
  }, [periods, currentYearLabel])

  const filteredAbsences = useMemo(
    () => initialAbsences.filter(a => currentPeriodIds.has(a.period_id)),
    [initialAbsences, currentPeriodIds]
  )

  const filteredInitialWarnings = useMemo(
    () => initialWarnings.filter(w => currentPeriodIds.has(w.period_id)),
    [initialWarnings, currentPeriodIds]
  )

  // Lookup maps
  const PERIOD_FULL_LABELS: Record<string, string> = {
    T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
    S1: 'Semestre 1', S2: 'Semestre 2',
  }
  const periodFullLabel = (label: string) => PERIOD_FULL_LABELS[label] ?? label
  const currentYearPeriods = useMemo(
    () => periods.filter(p => currentPeriodIds.has(p.id)),
    [periods, currentPeriodIds]
  )
  const periodMap = useMemo(() => new Map(periods.map(p => [p.id, periodFullLabel(p.label)])), [periods])

  const [warnings, setWarnings] = useState(filteredInitialWarnings)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedHelp, setExpandedHelp] = useState(false)

  // Form state
  const [formPeriod, setFormPeriod] = useState(currentYearPeriods[0]?.id ?? periods[0]?.id ?? '')
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10))
  const [formSeverity, setFormSeverity] = useState<WarningSeverity | ''>('')
  const [formMotif, setFormMotif] = useState('')
  const [formFiles, setFormFiles] = useState<File[]>([])

  const classMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of enrollments) {
      if (e.classes) m.set(e.class_id, e.classes.name)
    }
    return m
  }, [enrollments])

  // ─── Compteurs globaux ──────────────────────────────────────────────────────

  const counts = useMemo(() => {
    let abs = 0, unjustified = 0, retards = 0
    for (const a of filteredAbsences) {
      if (a.absence_type === 'absence') {
        abs++
        if (!a.is_justified) unjustified++
      } else {
        retards++
      }
    }
    return { abs, unjustified, retards, warnings: warnings.length }
  }, [filteredAbsences, warnings])

  // ─── Ajout d'un avertissement ───────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setShowForm(false)
    setFormPeriod(currentYearPeriods[0]?.id ?? periods[0]?.id ?? '')
    setFormDate(new Date().toISOString().slice(0, 10))
    setFormSeverity('')
    setFormMotif('')
    setFormFiles([])
    setError(null)
  }, [currentYearPeriods, periods])

  const handleSave = useCallback(async () => {
    if (!formSeverity) { setError('Veuillez sélectionner un type.'); return }
    if (!formMotif.trim()) { setError('Veuillez saisir un motif.'); return }
    if (!formPeriod) { setError('Veuillez sélectionner une période.'); return }

    // Trouver le class_id depuis les enrollments (prend le premier actif)
    const classId = enrollments[0]?.class_id
    if (!classId) { setError('Aucune classe trouvée.'); return }

    setSaving(true)
    setError(null)

    // 1. Insert warning
    const { data: newWarning, error: insertErr } = await supabase
      .from('student_warnings')
      .insert({
        etablissement_id: etablissementId,
        student_id: studentId,
        class_id: classId,
        period_id: formPeriod,
        warning_date: formDate,
        severity: formSeverity,
        motif: formMotif.trim(),
      })
      .select('id, class_id, period_id, warning_date, severity, motif, issued_by, created_at')
      .single()

    if (insertErr || !newWarning) {
      setError(insertErr?.message ?? 'Erreur lors de l\'enregistrement.')
      setSaving(false)
      return
    }

    // 2. Upload attachments
    const attachments: { id: string; file_url: string; file_name: string }[] = []
    for (const file of formFiles) {
      const filePath = `${etablissementId}/${studentId}/${newWarning.id}/${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('warning-attachments')
        .upload(filePath, file)

      if (!uploadErr) {
        const { data: att } = await supabase
          .from('student_warning_attachments')
          .insert({
            warning_id: newWarning.id,
            file_url: filePath,
            file_name: file.name,
          })
          .select('id, file_url, file_name')
          .single()

        if (att) attachments.push(att)
      }
    }

    setWarnings(prev => [{ ...newWarning, attachments }, ...prev])
    resetForm()
    setSaving(false)
  }, [formSeverity, formMotif, formPeriod, formDate, formFiles, enrollments, etablissementId, studentId, supabase, resetForm])

  // ─── Suppression ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (warningId: string) => {
    // Delete attachments from storage first
    const warning = warnings.find(w => w.id === warningId)
    if (warning) {
      const paths = warning.attachments.map(att => att.file_url)
      if (paths.length) {
        await supabase.storage.from('warning-attachments').remove(paths)
      }
    }

    const { error: delErr } = await supabase
      .from('student_warnings')
      .delete()
      .eq('id', warningId)

    if (!delErr) {
      setWarnings(prev => prev.filter(w => w.id !== warningId))
    }
    setConfirmDelete(null)
  }, [warnings, supabase])

  // ─── Gestion fichiers ──────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const valid = Array.from(e.target.files).filter(f => {
        if (f.size > 500 * 1024) {
          setError(`Le fichier "${f.name}" dépasse 500 Ko.`)
          return false
        }
        return true
      })
      if (valid.length) setFormFiles(prev => [...prev, ...valid])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFormFiles(prev => prev.filter((_, i) => i !== index))
  }

  // ─── Ouvrir une pièce jointe (signed URL) ──────────────────────────────────

  const openAttachment = useCallback(async (filePath: string) => {
    const { data } = await supabase.storage
      .from('warning-attachments')
      .createSignedUrl(filePath, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }, [supabase])

  // ─── Tri absences par date décroissante ─────────────────────────────────────

  const sortedAbsences = useMemo(
    () => [...filteredAbsences].sort((a, b) => b.absence_date.localeCompare(a.absence_date)),
    [filteredAbsences]
  )

  const sortedWarnings = useMemo(
    () => [...warnings].sort((a, b) => b.warning_date.localeCompare(a.warning_date)),
    [warnings]
  )

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* En-tête année */}
      {currentYearLabel && (
        <p className="text-xs font-semibold text-warm-500">Année scolaire {currentYearLabel}</p>
      )}

      {/* Compteurs globaux */}
      <div className="grid grid-cols-4 gap-2">
        <CounterCard label="Absences" value={counts.abs} color="text-red-600" bg="bg-red-50" />
        <CounterCard label="Non justifiées" value={counts.unjustified} color="text-orange-600" bg="bg-orange-50" />
        <CounterCard label="Retards" value={counts.retards} color="text-amber-600" bg="bg-amber-50" />
        <CounterCard label="Avertissements" value={counts.warnings} color="text-purple-600" bg="bg-purple-50" />
      </div>

      {/* Section Absences & Retards */}
      <div className="card">
        <div className="px-3 py-1.5 border-b border-warm-200 flex items-center gap-2">
          <AlertTriangle size={13} className="text-warm-500" />
          <h3 className="text-xs font-semibold text-warm-700">Absences et retards</h3>
          <span className="text-[11px] text-warm-400 ml-auto">{sortedAbsences.length} enreg.</span>
        </div>

        {sortedAbsences.length === 0 ? (
          <p className="px-3 py-2 text-xs text-warm-400 italic">Aucune absence ni retard enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-warm-100 text-warm-500">
                  <th className="text-left px-3 py-1 font-medium">Date</th>
                  <th className="text-left px-3 py-1 font-medium">Période</th>
                  <th className="text-left px-3 py-1 font-medium">Type</th>
                  <th className="text-center px-3 py-1 font-medium">Justifié</th>
                  <th className="text-left px-3 py-1 font-medium">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {sortedAbsences.map(a => (
                  <tr key={a.id} className="border-b border-warm-50 hover:bg-warm-50/50">
                    <td className="px-3 py-1 whitespace-nowrap">
                      {new Date(a.absence_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-3 py-1 whitespace-nowrap text-warm-500">
                      {periodMap.get(a.period_id) ?? '–'}
                    </td>
                    <td className="px-3 py-1">
                      <span className={clsx(
                        'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full',
                        a.absence_type === 'absence' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {a.absence_type === 'absence' ? (
                          <><AlertTriangle size={10} /> Absence</>
                        ) : (
                          <><Clock size={10} /> Retard</>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-1 text-center">
                      {a.is_justified ? (
                        <span className="text-[11px] text-green-600 font-medium">Oui</span>
                      ) : (
                        <span className="text-[11px] text-red-500">Non</span>
                      )}
                    </td>
                    <td className="px-3 py-1 text-warm-500 max-w-[200px] truncate">
                      {a.comment || '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section Avertissements */}
      <div className="card">
        <div className="px-3 py-1.5 border-b border-warm-200 flex items-center gap-2">
          <ShieldIcon className="text-warm-500" />
          <h3 className="text-xs font-semibold text-warm-700">Avertissements</h3>
          <span className="text-[11px] text-warm-400">{sortedWarnings.length} enreg.</span>
          <FloatButton
            variant="submit"
            onClick={() => { setShowForm(true); setError(null) }}
            className="ml-auto text-xs flex items-center gap-1"
            disabled={showForm}
          >
            <Plus size={12} />
            Ajouter
          </FloatButton>
        </div>

        {/* Formulaire d'ajout */}
        {showForm && (
          <div className="p-3 border-b border-warm-200 bg-warm-50/50 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Période */}
              <div>
                <FloatSelect
                  label="Période"
                  className="text-xs"
                  value={formPeriod}
                  onChange={e => setFormPeriod(e.target.value)}
                >
                  {currentYearPeriods.map(p => (
                    <option key={p.id} value={p.id}>{periodFullLabel(p.label)}</option>
                  ))}
                </FloatSelect>
              </div>

              {/* Date */}
              <div>
                <FloatInput
                  label="Date"
                  type="date"
                  className="text-xs"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </div>

              {/* Type */}
              <div>
                <FloatSelect
                  label="Type"
                  className="text-xs"
                  value={formSeverity}
                  onChange={e => setFormSeverity(e.target.value as WarningSeverity)}
                >
                  <option value=""></option>
                  {(Object.keys(SEVERITY_CONFIG) as WarningSeverity[]).map(key => (
                    <option key={key} value={key}>{SEVERITY_CONFIG[key].label}</option>
                  ))}
                </FloatSelect>
              </div>
            </div>

            {/* Aide contextuelle sur les types */}
            <div>
              <button
                type="button"
                onClick={() => setExpandedHelp(h => !h)}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <HelpCircle size={12} />
                Aide au choix du type
                {expandedHelp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {expandedHelp && (
                <div className="mt-1.5 space-y-1.5 text-[11px] text-warm-600 bg-white rounded border border-warm-200 p-2">
                  {(Object.keys(SEVERITY_CONFIG) as WarningSeverity[]).map(key => (
                    <div key={key}>
                      <span className={clsx('font-semibold inline-block px-1 py-0.5 rounded text-[10px] mr-1', SEVERITY_CONFIG[key].color)}>
                        {SEVERITY_CONFIG[key].label}
                      </span>
                      <span>{SEVERITY_CONFIG[key].description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Motif */}
            <div>
              <FloatTextarea
                label="Motif"
                className="text-xs"
                rows={2}
                placeholder="Décrire le motif de l'avertissement..."
                value={formMotif}
                onChange={e => setFormMotif(e.target.value)}
              />
            </div>

            {/* Pièces jointes */}
            <div>
              <label className="block text-[11px] font-medium text-warm-600 mb-0.5">Pièces jointes</label>
              <div className="flex flex-wrap items-center gap-2">
                <FloatButton
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs flex items-center gap-1"
                >
                  <Paperclip size={12} />
                  Ajouter un fichier
                </FloatButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {formFiles.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-warm-100 text-warm-600 px-2 py-1 rounded">
                    {f.name}
                    <button type="button" onClick={() => removeFile(i)} className="text-warm-400 hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}

            <div className="flex gap-2">
              <FloatButton
                variant="submit"
                onClick={handleSave}
                disabled={saving}
                loading={saving}
                className="text-xs"
              >
                Enregistrer
              </FloatButton>
              <FloatButton
                variant="secondary"
                onClick={resetForm}
                disabled={saving}
                className="text-xs"
              >
                Annuler
              </FloatButton>
            </div>
          </div>
        )}

        {/* Liste des avertissements */}
        {sortedWarnings.length === 0 && !showForm ? (
          <p className="px-3 py-2 text-xs text-warm-400 italic">Aucun avertissement enregistré.</p>
        ) : (
          <div className="divide-y divide-warm-100">
            {sortedWarnings.map(w => (
              <div key={w.id} className="px-3 py-2 hover:bg-warm-50/50">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-warm-700 whitespace-nowrap">
                        {new Date(w.warning_date).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-[11px] text-warm-400">
                        {periodMap.get(w.period_id) ?? '–'}
                      </span>
                      <span className={clsx(
                        'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        SEVERITY_CONFIG[w.severity]?.color ?? 'bg-warm-100 text-warm-600'
                      )}>
                        {SEVERITY_CONFIG[w.severity]?.label ?? w.severity}
                      </span>
                    </div>
                    <p className="text-xs text-warm-600 mt-0.5 whitespace-pre-line">{w.motif}</p>
                    {w.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {w.attachments.map(att => (
                          <button
                            key={att.id}
                            onClick={() => openAttachment(att.file_url)}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            <Paperclip size={10} />
                            {att.file_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Suppression */}
                  <div className="flex-shrink-0">
                    {confirmDelete === w.id ? (
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-red-600">Supprimer ?</span>
                        <button onClick={() => handleDelete(w.id)} className="text-red-600 font-semibold hover:underline">Oui</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-warm-500 font-semibold hover:underline">Non</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(w.id)}
                        className="text-warm-300 hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function CounterCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={clsx('rounded-lg p-2 text-center', bg)}>
      <div className={clsx('text-lg font-bold', color)}>{value}</div>
      <div className="text-[11px] text-warm-500">{label}</div>
    </div>
  )
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
