'use client'

import { useState, useMemo, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { Trash2, Paperclip, X, ChevronDown, ChevronUp } from 'lucide-react'
import type { WarningSeverity } from '@/types/database'
import { FloatSelect, FloatInput, FloatTextarea, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import FormModal from '@/components/ui/FormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { Puce, type Ton } from '@/components/dashboard/tdb'
import { jourParis } from '@/lib/tenant/abonnement'
import { ouvrirDansOnglet } from '@/lib/pdf/ouvrir'

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
  is_current?: boolean
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
  /** Fiche en lecture seule (enseignant). La RLS refuse desormais l'ecriture de
   *  `student_warnings` (lot 3) : sans cela les boutons resteraient offerts et
   *  echoueraient EN SILENCE. Meme regle que le formulaire depuis le 24/09. */
  lectureSeule?: boolean
}

// ─── Descriptions des types de gravité ──────────────────────────────────────

// Ton = pastille d'etat de la charte (`Puce`) : ambre, ardoise, orange, rouge.
const SEVERITY_CONFIG: Record<WarningSeverity, { label: string; ton: Ton; description: string }> = {
  punition: {
    label: 'Punition',
    ton: 'attente',
    description: 'Mesure prise en cas de manquement mineur aux obligations ou de comportement perturbateur.',
  },
  prevention: {
    label: 'Mesure de prévention',
    ton: 'info',
    description: 'Mesure visant à éviter qu\'un acte dangereux se produise, prévue par le règlement intérieur (ex : confiscation d\'un objet dangereux ou interdit).',
  },
  conservatoire: {
    label: 'Mesure conservatoire',
    ton: 'orange',
    description: 'Mesure garantissant l\'ordre dans l\'établissement en cas de procédure disciplinaire engagée. L\'accès à l\'établissement peut être interdit pendant 2 jours ouvrables minimum ou jusqu\'à la date du conseil de discipline. Non inscrite au dossier scolaire.',
  },
  sanction: {
    label: 'Sanction',
    ton: 'danger',
    description: 'Mesure prise en cas de manquement grave ou répété aux obligations : atteintes aux personnes (violences verbales ou physiques) ou aux biens (dégradation, destruction de matériel). Individuelle uniquement, prévue par le règlement intérieur.',
  },
}

// ─── Composant principal ────────────────────────────────────────────────────

const PERIOD_FULL_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

// Au niveau du module : ne depend que de la constante, donc pas une dependance de hook.
const periodFullLabel = (label: string) => PERIOD_FULL_LABELS[label] ?? label

// « AAAA-MM-JJ » -> « JJ/MM/AAAA » par simple decoupage : `new Date('AAAA-MM-JJ')`
// est lu en UTC et pouvait afficher la veille selon le fuseau.
const dateFr = (d: string) => d.slice(0, 10).split('-').reverse().join('/')

type FiltreAbsences = '' | 'absence' | 'non_justifiee' | 'retard'

export default function StudentDiscipline({
  studentId, etablissementId, absences: initialAbsences, warnings: initialWarnings, periods, enrollments, currentYearLabel,
  lectureSeule = false,
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
  const [formPeriod, setFormPeriod] = useState((currentYearPeriods.find(p => p.is_current) ?? currentYearPeriods[0])?.id ?? periods[0]?.id ?? '')
  const [formDate, setFormDate] = useState(jourParis(new Date()))
  const [filtreAbs, setFiltreAbs] = useState<FiltreAbsences>('')
  const [formSeverity, setFormSeverity] = useState<WarningSeverity | ''>('')
  const [formMotif, setFormMotif] = useState('')
  const [formFiles, setFormFiles] = useState<File[]>([])

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
    setFormPeriod((currentYearPeriods.find(p => p.is_current) ?? currentYearPeriods[0])?.id ?? periods[0]?.id ?? '')
    setFormDate(jourParis(new Date()))
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
    // La ligne d'abord, les pieces jointes ensuite (voir StudentDocuments).
    const echec = erreurEcriture(
      await supabase.from('student_warnings').delete().eq('id', warningId).select('id'),
      'Cet avertissement',
    )
    if (echec) { setError(echec); setConfirmDelete(null); return }

    const warning = warnings.find(w => w.id === warningId)
    if (warning) {
      const paths = warning.attachments.map(att => att.file_url)
      if (paths.length) {
        await supabase.storage.from('warning-attachments').remove(paths)
      }
    }
    setWarnings(prev => prev.filter(w => w.id !== warningId))
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

  // Onglet ouvert AU CLIC, avant l'URL signee (sinon bloque comme popup).
  const openAttachment = useCallback((filePath: string) => {
    void ouvrirDansOnglet(async () => {
      const { data } = await supabase.storage.from('warning-attachments').createSignedUrl(filePath, 60)
      return data?.signedUrl ?? null
    })
  }, [supabase])

  // ─── Tri absences par date décroissante ─────────────────────────────────────

  const sortedAbsences = useMemo(
    () => [...filteredAbsences]
      .filter(a =>
        filtreAbs === '' ? true
        : filtreAbs === 'absence' ? a.absence_type === 'absence'
        : filtreAbs === 'retard' ? a.absence_type === 'retard'
        : a.absence_type === 'absence' && !a.is_justified)
      .sort((a, b) => b.absence_date.localeCompare(a.absence_date)),
    [filteredAbsences, filtreAbs]
  )

  const sortedWarnings = useMemo(
    () => [...warnings].sort((a, b) => b.warning_date.localeCompare(a.warning_date)),
    [warnings]
  )

  // ─── Rendu ─────────────────────────────────────────────────────────────────
  // Charte du 15/10 : encadres `card` + bandeau `.encadre-titre`, pastilles d'etat
  // (`Puce`), compteurs d'absences = switch de filtre, saisie en modale. L'annee
  // n'est pas rappelee : la fiche ne montre que l'annee en cours.

  const warningAConfirmer = confirmDelete ? warnings.find(w => w.id === confirmDelete) ?? null : null
  const nbPj = (n: number) => `${n} pièce${n > 1 ? 's' : ''} jointe${n > 1 ? 's' : ''}`

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-3 items-start">

      {/* ── Absences et retards ── */}
      <section className="card p-3 space-y-2" aria-labelledby="disc-absences">
        <h2 id="disc-absences" className="encadre-titre text-xs font-bold uppercase tracking-widest">
          Absences et retards
        </h2>

        <FiltreSwitch
          ariaLabel="Filtrer les absences et retards"
          actif={filtreAbs}
          onChange={v => setFiltreAbs(v as FiltreAbsences)}
          options={[
            { valeur: '',              nombre: filteredAbsences.length, libelle: 'au total' },
            { valeur: 'absence',       nombre: counts.abs,              libelle: counts.abs > 1 ? 'absences' : 'absence', couleur: 'text-red-600' },
            { valeur: 'non_justifiee', nombre: counts.unjustified,      libelle: counts.unjustified > 1 ? 'non justifiées' : 'non justifiée', couleur: 'text-orange-600' },
            { valeur: 'retard',        nombre: counts.retards,          libelle: counts.retards > 1 ? 'retards' : 'retard', couleur: 'text-amber-700' },
          ]}
        />

        {sortedAbsences.length === 0 ? (
          <p className="py-4 text-center text-xs text-warm-700 italic">
            {filtreAbs ? 'Aucune ligne pour ce filtre.' : 'Aucune absence ni retard enregistré.'}
          </p>
        ) : (
          <div className="-mx-3 overflow-x-auto">
            <table className="w-full text-xs" aria-label="Absences et retards">
              <thead>
                <tr className="border-b border-warm-100">
                  <th className="text-left list-th">Date</th>
                  <th className="text-left list-th">Période</th>
                  <th className="text-left list-th">Type</th>
                  <th className="text-left list-th">Justifié</th>
                  <th className="text-left list-th">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {sortedAbsences.map(a => (
                  <tr key={a.id}>
                    <td className="list-td whitespace-nowrap tabular-nums text-secondary-800">{dateFr(a.absence_date)}</td>
                    <td className="list-td whitespace-nowrap text-warm-700">{periodMap.get(a.period_id) ?? '·'}</td>
                    <td className="list-td">
                      {a.absence_type === 'absence'
                        ? <Puce ton="danger">Absence</Puce>
                        : <Puce ton="attente">Retard</Puce>}
                    </td>
                    <td className="list-td">
                      {a.is_justified ? <Puce ton="ok">Oui</Puce> : <Puce ton="danger">Non</Puce>}
                    </td>
                    <td className="list-td text-warm-700 max-w-[220px] truncate">{a.comment || '·'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Avertissements ── */}
      <section className="card p-3 space-y-2" aria-labelledby="disc-avertissements">
        <div className="encadre-titre justify-between gap-2">
          <h2 id="disc-avertissements" className="text-xs font-bold uppercase tracking-widest">
            Avertissements
            <span className="ml-1.5 font-semibold normal-case tracking-normal text-warm-700">({counts.warnings})</span>
          </h2>
          {!lectureSeule && (
            <FloatButton variant="submit" size="mini" onClick={() => { setShowForm(true); setError(null) }}>
              Ajouter
            </FloatButton>
          )}
        </div>

        {error && !showForm && !warningAConfirmer && (
          <p role="alert" className="text-xs text-red-600">{error}</p>
        )}

        {sortedWarnings.length === 0 ? (
          <p className="py-4 text-center text-xs text-warm-700 italic">Aucun avertissement enregistré.</p>
        ) : (
          <ul className="-mx-3 divide-y divide-warm-50" aria-label="Avertissements">
            {sortedWarnings.map(w => (
              <li key={w.id} className="px-3 py-2 flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold tabular-nums text-secondary-800">{dateFr(w.warning_date)}</span>
                    <span className="text-warm-700">{periodMap.get(w.period_id) ?? '·'}</span>
                    <Puce ton={SEVERITY_CONFIG[w.severity]?.ton ?? 'neutre'}>
                      {SEVERITY_CONFIG[w.severity]?.label ?? w.severity}
                    </Puce>
                  </div>
                  <p className="text-xs text-secondary-700 whitespace-pre-line">{w.motif}</p>
                  {w.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {w.attachments.map(att => (
                        <button
                          key={att.id}
                          type="button"
                          onClick={() => openAttachment(att.file_url)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                        >
                          <Paperclip size={11} aria-hidden="true" />
                          {att.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!lectureSeule && (
                  <Tooltip content="Supprimer">
                    <button
                      type="button"
                      onClick={() => { setConfirmDelete(w.id); setError(null) }}
                      aria-label="Supprimer l'avertissement"
                      className="p-1 text-warm-700 hover:text-red-600 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Tooltip>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Modale d'ajout d'un avertissement (fermeture X / Annuler seulement) ── */}
      {showForm && (
        <FormModal
          title="Nouvel avertissement"
          onClose={resetForm}
          maxWidth="max-w-lg"
          footer={
            <>
              <FloatButton variant="secondary" onClick={resetForm} disabled={saving}>Annuler</FloatButton>
              <FloatButton variant="submit" onClick={handleSave} disabled={saving} loading={saving}>Enregistrer</FloatButton>
            </>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <FloatSelect label="Période" required value={formPeriod} onChange={e => setFormPeriod(e.target.value)}>
                {currentYearPeriods.map(p => (
                  <option key={p.id} value={p.id}>{periodFullLabel(p.label)}</option>
                ))}
              </FloatSelect>
              <FloatInput label="Date" type="date" required value={formDate} onChange={e => setFormDate(e.target.value)} />
              <FloatSelect label="Type" required value={formSeverity} onChange={e => setFormSeverity(e.target.value as WarningSeverity)}>
                <option value="" disabled hidden />
                {(Object.keys(SEVERITY_CONFIG) as WarningSeverity[]).map(key => (
                  <option key={key} value={key}>{SEVERITY_CONFIG[key].label}</option>
                ))}
              </FloatSelect>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setExpandedHelp(h => !h)}
                aria-expanded={expandedHelp}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
              >
                Aide au choix du type
                {expandedHelp ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
              </button>
              {expandedHelp && (
                <div className="mt-1.5 space-y-1.5 text-[11px] text-warm-700 rounded-lg border border-warm-200 p-2">
                  {(Object.keys(SEVERITY_CONFIG) as WarningSeverity[]).map(key => (
                    <p key={key}>
                      <span className="mr-1"><Puce ton={SEVERITY_CONFIG[key].ton}>{SEVERITY_CONFIG[key].label}</Puce></span>
                      {SEVERITY_CONFIG[key].description}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <FloatTextarea
              label="Motif"
              required
              rows={3}
              value={formMotif}
              onChange={e => setFormMotif(e.target.value)}
            />

            <div className="flex flex-wrap items-center gap-2">
              <FloatButton type="button" variant="secondary" size="mini" onClick={() => fileInputRef.current?.click()}>
                Joindre un fichier
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
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-warm-100 text-warm-700 px-2 py-1 rounded">
                  {f.name}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Retirer ${f.name}`}
                    className="text-warm-700 hover:text-red-600 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>

            {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          </div>
        </FormModal>
      )}

      {/* ── Confirmation de suppression ── */}
      {warningAConfirmer && (
        <ConfirmModal
          title="Supprimer l'avertissement ?"
          confirmLabel="Supprimer"
          variant="danger"
          onConfirm={() => handleDelete(warningAConfirmer.id)}
          onCancel={() => setConfirmDelete(null)}
        >
          <p className="text-sm text-secondary-700">
            {SEVERITY_CONFIG[warningAConfirmer.severity]?.label ?? warningAConfirmer.severity} du {dateFr(warningAConfirmer.warning_date)}
            {warningAConfirmer.attachments.length > 0 && `, avec ${nbPj(warningAConfirmer.attachments.length)}`}.
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}

