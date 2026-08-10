'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import Image from 'next/image'
import { ChevronRight, ChevronDown, FileCheck, AlertTriangle, X, Trash2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import { MaleAvatar, FemaleAvatar, DefaultAvatar } from './AvatarSilhouette'
import { classInfoWithTeacher } from '@/components/dashboard/classInfo'
import type { Period, Absence, AbsenceType } from '@/types/database'

// ─── Types props ─────────────────────────────────────────────────────────────

type ClassRow = {
  id: string
  name: string
  level: string
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  main_teacher_name: string | null
  main_teacher_civilite: string | null
  cotisation_label: string | null
}

type StudentRow = {
  student_id: string
  class_id: string
  first_name: string
  last_name: string
  student_number: string
  gender: string | null
  photo_url: string | null
}

type EtablissementInfo = {
  nom: string
  adresse: string | null
  telephone: string | null
  logo_url: string | null
}

/**
 * ÉLÈVES ou ADULTES — le même écran.
 *
 * Une classe adulte n'a aucun `enrollments` : ses participants sont des TUTEURS
 * (`parent_class_enrollments`) et leur assiduité vit dans `adult_absences`, la
 * table miroir, parce que `absences.student_id` pointe vers `students`.
 *
 * On ne duplique pas pour autant ces 1 700 lignes : contrairement aux deux écrans
 * d'affectation, qui font des choses différentes, c'est ici rigoureusement le même
 * écran — trombinoscope, statuts, justification, impression. Seules changent la
 * source des participants et la table cible. Le composant travaille donc sur une
 * CLÉ DE PARTICIPANT UNIFIÉE, comme la saisie de notes, les bulletins et le suivi
 * des devoirs : `student_id` vaut l'uuid d'un élève, ou `parentId-tutorNumber`
 * pour un adulte. La page fournit les participants déjà normalisés ; les
 * écritures reconvertissent la clé au dernier moment.
 */
export type ModeAppel = 'students' | 'adults'

interface AbsencesClientProps {
  classes: ClassRow[]
  periods: Period[]
  students: StudentRow[]
  initialAbsences: Absence[]
  etablissementId: string
  schoolYearId: string | null
  etablissement: EtablissementInfo | null
  yearLabel: string | null
  /** Rôle du profil connecté : la vue globale est réservée à l'encadrement. */
  role: string
  /** Élèves par défaut ; `adults` bascule sur les classes et la table adultes. */
  mode?: ModeAppel
}

/** Table d'assiduité correspondant au mode. */
export function tableAppel(mode: ModeAppel) {
  return mode === 'adults' ? 'adult_absences' : 'absences'
}

/**
 * Clé unifiée → colonnes de la base.
 *
 * On coupe au DERNIER tiret : un uuid en contient déjà quatre, un `split('-')`
 * naïf le mettrait en pièces. Même règle que la notation des adultes.
 */
export function colonnesParticipant(mode: ModeAppel, cle: string): Record<string, unknown> {
  if (mode === 'students') return { student_id: cle }
  const i = cle.lastIndexOf('-')
  return { parent_id: cle.slice(0, i), tutor_number: Number(cle.slice(i + 1)) }
}

/** Ligne de base → forme unifiée attendue par l'écran (`student_id` = la clé). */
export function normaliserAbsence(row: any, mode: ModeAppel): Absence {
  if (mode === 'students') return row as Absence
  return { ...row, student_id: `${row.parent_id}-${row.tutor_number}` } as Absence
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

const ALERT_THRESHOLD = 3 // absences NJ

/** Sentinelle « toutes les classes ». Valeur NON vide volontairement : sur un
 *  `FloatSelect`, une valeur vide fait retomber le libellé flottant par-dessus
 *  le texte de l'option (piège déjà payé sur les communications). */
const ALL_CLASSES = '__all__'

/** Profils autorisés à la vue globale : l'encadrement. L'enseignant reste sur
 *  ses classes une par une — il fait l'appel, il n'arbitre pas entre classes. */
const GLOBAL_VIEW_ROLES = ['admin', 'direction', 'responsable_pedagogique', 'secretaire']

/** Nombre d'élèves listés dans le palmarès des plus absents. */
const TOP_ABSENT_LIMIT = 10

/** « Civilité NOM Prénom » du titulaire, ou chaîne vide. */
const teacherLabel = (c: ClassRow) =>
  c.main_teacher_civilite && c.main_teacher_name
    ? `${c.main_teacher_civilite} ${c.main_teacher_name}`
    : (c.main_teacher_name ?? '')

/** Ligne d'infos de classe, via le helper PARTAGÉ du projet :
 *  « Civilité NOM Prénom · Cotisation · Niveau X · Samedi 09:00-12:00 ».
 *  Le constructeur local qui existait ici affichait la plage horaire avec un
 *  point médian (« 09:00·12:00 ») au lieu du tiret, et omettait le niveau
 *  différemment. Une seule implémentation, donc un seul format. */
const classInfoLine = (c: ClassRow) =>
  classInfoWithTeacher({ ...c, cotisation_types: { label: c.cotisation_label } }, teacherLabel(c))

const fmtDate = (d: string) => {
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function AbsencesClient({
  classes,
  periods,
  students,
  initialAbsences,
  etablissementId,
  schoolYearId,
  etablissement,
  yearLabel,
  role,
  mode = 'students',
}: AbsencesClientProps) {
  const TABLE = tableAppel(mode)
  /** Le mot juste : on ne fait pas l'appel d'« élèves » dans un cours adultes. */
  const MOT     = mode === 'adults' ? 'participant' : 'élève'
  const MOT_MAJ = mode === 'adults' ? 'Participant' : 'Élève'

  // Inutile de proposer une vue « toutes les classes » quand il n'y en a qu'une.
  const canSeeAllClasses = GLOBAL_VIEW_ROLES.includes(role) && classes.length > 1
  const [selectedClassId,  setSelectedClassId]  = useState<string | null>(classes.length === 1 ? classes[0].id : null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>((periods.find(p => p.is_current) ?? periods[0])?.id ?? null)
  const [absences,         setAbsences]         = useState<Absence[]>(initialAbsences)
  const [expandedStudent,  setExpandedStudent]  = useState<string | null>(null)
  const [showSaisie,       setShowSaisie]       = useState(false)
  const [justifyTarget,    setJustifyTarget]    = useState<Absence | null>(null)
  const [validatedDates,   setValidatedDates]   = useState<Set<string>>(new Set())


  const isAllClasses = selectedClassId === ALL_CLASSES

  // Élèves de la classe sélectionnée — ou de toutes en vue globale.
  const classStudents = useMemo(
    () => isAllClasses ? students : students.filter(s => s.class_id === selectedClassId),
    [students, selectedClassId, isAllClasses]
  )

  // Absences de la classe + période — ou de la période seule en vue globale.
  const periodAbsences = useMemo(
    () => absences.filter(a =>
      a.period_id === selectedPeriodId && (isAllClasses || a.class_id === selectedClassId)
    ),
    [absences, selectedClassId, selectedPeriodId, isAllClasses]
  )

  // Compteurs par élève
  const countsByStudent = useMemo(() => {
    const map = new Map<string, { abs: number; absNJ: number; ret: number }>()
    for (const s of classStudents) {
      map.set(s.student_id, { abs: 0, absNJ: 0, ret: 0 })
    }
    for (const a of periodAbsences) {
      const c = map.get(a.student_id)
      if (!c) continue
      if (a.absence_type === 'absence') {
        c.abs++
        if (!a.is_justified) c.absNJ++
      } else {
        c.ret++
      }
    }
    return map
  }, [classStudents, periodAbsences])

  // Résumé global — calculé sur les ABSENCES elles-mêmes, et non en sommant les
  // compteurs par élève. Ces derniers ne portent que sur les élèves ACTUELLEMENT
  // inscrits : les absences d'un élève désinscrit en cours d'année en sortaient,
  // alors que le tableau par classe les compte — deux totaux contradictoires sur
  // le même écran.
  const summary = useMemo(() => {
    let abs = 0, absNJ = 0, ret = 0
    for (const a of periodAbsences) {
      if (a.absence_type === 'absence') {
        abs++
        if (!a.is_justified) absNJ++
      } else {
        ret++
      }
    }
    return { abs, absNJ, ret }
  }, [periodAbsences])

  // ─── Vue globale : agrégats par CLASSE ────────────────────────────────────
  // Aucune requête supplémentaire : la page charge déjà les élèves et les
  // absences de TOUTES les classes, seul le filtrage était restrictif.
  const classStats = useMemo(() => {
    if (!isAllClasses) return []
    const base = new Map(classes.map(c => [c.id, { cls: c, effectif: 0, abs: 0, absNJ: 0, ret: 0 }]))
    for (const s of students) base.get(s.class_id) && base.get(s.class_id)!.effectif++
    for (const a of periodAbsences) {
      const row = base.get(a.class_id)
      if (!row) continue
      if (a.absence_type === 'absence') {
        row.abs++
        if (!a.is_justified) row.absNJ++
      } else {
        row.ret++
      }
    }
    // Tri par absences décroissantes (choix utilisateur) : la lecture répond à
    // « où agir ? ». Départages successifs pour un ordre stable.
    return [...base.values()].sort((a, b) =>
      b.abs - a.abs || b.absNJ - a.absNJ || b.ret - a.ret || a.cls.name.localeCompare(b.cls.name)
    )
  }, [isAllClasses, classes, students, periodAbsences])

  // ─── Vue globale : élèves les plus absents, tous cours confondus ──────────
  const topAbsentStudents = useMemo(() => {
    if (!isAllClasses) return []
    // Un élève n'est inscrit que dans UNE classe à la fois : `students` ne
    // contient donc qu'une ligne par élève, sans dédoublonnage à faire.
    const classById = new Map(classes.map(c => [c.id, c]))
    return students
      .map(s => {
        const c = countsByStudent.get(s.student_id) ?? { abs: 0, absNJ: 0, ret: 0 }
        // La classe entière est conservée, pas seulement son nom : l'infobulle
        // affiche la même ligne d'infos que partout ailleurs.
        return { student: s, cls: classById.get(s.class_id) ?? null, ...c }
      })
      .filter(r => r.abs + r.ret > 0)
      .sort((a, b) =>
        b.absNJ - a.absNJ || b.abs - a.abs || b.ret - a.ret ||
        a.student.last_name.localeCompare(b.student.last_name)
      )
      .slice(0, TOP_ABSENT_LIMIT)
  }, [isAllClasses, students, classes, countsByStudent])

  // Infos classe
  const noSchoolYear    = !schoolYearId
  const noClassOrPeriod = !selectedClassId || !selectedPeriodId

  // ─── Impression feuille d'appel PDF ─────────────────────────────────────────
  const handlePrintPdf = async () => {
    if (!selectedClassId) return
    const cls = classes.find(c => c.id === selectedClassId)
    if (!cls) return

    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let y = margin

    const COLORS = {
      primary:   [80, 117, 131] as [number, number, number],
      secondary: [46, 69, 80]   as [number, number, number],
      gray:      [120, 120, 120] as [number, number, number],
      headerBg:  [240, 245, 248] as [number, number, number],
    }

    // Logo
    if (etablissement?.logo_url) {
      try {
        const res = await fetch(etablissement.logo_url)
        if (res.ok) {
          const blob = await res.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          doc.addImage(base64, 'PNG', margin, y, 20, 20)
        }
      } catch { /* ignore */ }
    }

    const logoOffset = etablissement?.logo_url ? 25 : 0

    // Nom établissement
    // En-tete a 12 points, aligne sur le titre (voir bulletinPdf.ts).
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.secondary)
    doc.text(etablissement?.nom ?? '', margin + logoOffset, y + 7)

    // Adresse + téléphone
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    const infoLines: string[] = []
    if (etablissement?.adresse) infoLines.push(etablissement.adresse)
    if (etablissement?.telephone) infoLines.push(`Tél : ${etablissement.telephone}`)
    infoLines.forEach((line, i) => {
      doc.text(line, margin + logoOffset, y + 12 + i * 4)
    })

    // Titre à droite
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text("FEUILLE D'APPEL", pageWidth - margin, y + 7, { align: 'right' })

    if (yearLabel) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.gray)
      doc.text(yearLabel, pageWidth - margin, y + 12, { align: 'right' })
    }

    y += 25

    // Ligne de séparation
    doc.setDrawColor(...COLORS.primary)
    doc.setLineWidth(0.8)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6

    // Bloc infos classe
    doc.setFillColor(...COLORS.headerBg)
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F')

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.secondary)
    doc.text(`Classe : ${cls.name}`, margin + 4, y + 7)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    const infoParts: string[] = []
    if (cls.main_teacher_name) {
      infoParts.push(cls.main_teacher_civilite ? `${cls.main_teacher_civilite} ${cls.main_teacher_name}` : cls.main_teacher_name)
    }
    if (cls.level) infoParts.push(`Niveau ${cls.level}`)
    const timeStr = [cls.start_time, cls.end_time].filter(Boolean).map(t => t!.slice(0, 5)).join('·')
    const schedule = [cls.day_of_week, timeStr].filter(Boolean).join(' ')
    if (schedule) infoParts.push(schedule)
    doc.text(infoParts.join(' · '), margin + 4, y + 14)

    y += 25

    // Date du jour
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.secondary)
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, margin, y)
    doc.text(`Effectif : ${classStudents.length} ${MOT}${classStudents.length > 1 ? 's' : ''}`, pageWidth - margin, y, { align: 'right' })
    y += 6

    // Tableau des élèves
    const sortedStudents = [...classStudents].sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name))

    autoTable(doc, {
      startY: y,
      head: [['N°', 'Nom', 'Prénom', 'Présent', 'Absent', 'Retard', 'Observation']],
      body: sortedStudents.map((s, i) => [
        String(i + 1),
        s.last_name,
        s.first_name,
        '',
        '',
        '',
        '',
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.3 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { halign: 'center', cellWidth: 18 },
        4: { halign: 'center', cellWidth: 18 },
        5: { halign: 'center', cellWidth: 18 },
        6: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin },
    })

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 180, 180)
      doc.text(
        `FEUILLE D'APPEL · ${cls.name} · ${yearLabel ?? ''}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    }

    // Nom distinct de la feuille RENSEIGNEE (imprimee depuis la modale de saisie) :
    // les deux portaient `Feuille_appel_{classe}_{date}` et se confondaient des que
    // la date saisie etait celle du jour.
    // Date en composantes LOCALES : `toISOString()` est en UTC → a minuit en UTC+,
    // le fichier prenait la date de la veille.
    const d = new Date()
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    doc.save(`Feuille_appel_vierge_${cls.name.replace(/\s+/g, '_')}_${jour}.pdf`)
  }

  // Callback après saisie (ajouts, mises à jour, suppressions)
  const handleSaisieComplete = (added: Absence[], updated: Absence[], deletedIds: string[], savedDate: string) => {
    setAbsences(prev => {
      const afterDelete = prev.filter(a => !deletedIds.includes(a.id))
      const afterUpdate = afterDelete.map(a => {
        const u = updated.find(u => u.id === a.id)
        return u ?? a
      })
      return [...afterUpdate, ...added]
    })
    setValidatedDates(prev => new Set(prev).add(savedDate))
    // Ne pas fermer : le modal reste ouvert pour permettre l'impression
  }

  // Callback après justification
  const handleJustifyComplete = (updated: Absence) => {
    setAbsences(prev => prev.map(a => a.id === updated.id ? updated : a))
    setJustifyTarget(null)
  }

  // Retirer une justification
  const handleRemoveJustification = async (id: string) => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        is_justified: false,
        justification_date: null,
        justification_comment: null,
        justification_document_url: null,
      })
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setAbsences(prev => prev.map(a => a.id === id ? normaliserAbsence(data, mode) : a))
    }
  }

  // Suppression d'une absence
  const handleDelete = async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase.from(TABLE).delete().eq('id', id)
    if (!error) setAbsences(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="h-full flex flex-col gap-2 animate-fade-in">

      {/* ── Barre de sélection ── */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-4 flex-shrink-0">
        <FloatSelect
          label="Classe"
          value={selectedClassId ?? ''}
          onChange={e => { setSelectedClassId(e.target.value || null); setExpandedStudent(null) }}
          wrapperClassName="w-fit"
        >
          <option value=""></option>
          {/* Vue globale en tête : réservée à l'encadrement, et sans objet
              quand l'utilisateur n'a qu'une classe. */}
          {canSeeAllClasses && <option value={ALL_CLASSES}>Toutes les classes</option>}
          {classes.map(c => {
            const teacher = c.main_teacher_civilite && c.main_teacher_name
              ? `${c.main_teacher_civilite} ${c.main_teacher_name}`
              : c.main_teacher_name
            const infoParts = [c.name, teacher].filter(Boolean)
            return <option key={c.id} value={c.id}>{infoParts.join(' · ')}</option>
          })}
        </FloatSelect>

        {periods.length > 0 && (
          <div className="flex items-center gap-1">
            {periods.map(p => (
              <button
                key={p.id}
                onClick={() => { setSelectedPeriodId(p.id); setExpandedStudent(null) }}
                aria-pressed={selectedPeriodId === p.id}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200',
                  selectedPeriodId === p.id
                    ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)] shadow-[0_2px_6px_rgba(12,91,81,0.30)] hover:bg-[var(--brand-surface-2)] dark:hover:bg-[var(--brand-accent)] dark:hover:opacity-90'
                    : 'bg-white border border-warm-200 text-warm-700 hover:bg-warm-50 hover:border-warm-400'
                )}
              >
                {PERIOD_LABELS[p.label] ?? p.label}
              </button>
            ))}
          </div>
        )}

        {noSchoolYear && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            Aucune année scolaire active.
          </p>
        )}

        {/* Infos classe — à droite */}
        {selectedClassId && !isAllClasses && (() => {
          const cls = classes.find(c => c.id === selectedClassId)
          const info = cls ? classInfoLine(cls) : ''
          if (!info) return null
          return <span className="ml-auto text-sm font-medium text-warm-700 whitespace-nowrap">{info}</span>
        })()}
      </div>

      {/* ── Contenu principal ── */}
      <div className="card flex-1 min-h-0 flex flex-col">

        {noClassOrPeriod || noSchoolYear ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-warm-700">
              {noSchoolYear ? 'Aucune année scolaire active.' : 'Sélectionnez une classe et une période.'}
            </p>
          </div>
        ) : (
          <>
            {/* Barre résumé + bouton saisie */}
            <div className="px-3 py-1.5 flex items-center justify-between border-b border-warm-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Tooltip content={isAllClasses ? 'Choisissez une classe pour saisir un appel' : "Saisir l'appel d'une séance"}>
                  <FloatButton
                    variant="submit"
                    type="button"
                    onClick={() => setShowSaisie(true)}
                    disabled={isAllClasses}
                    size="mini"
                  >
                    Ajouter
                  </FloatButton>
                </Tooltip>
                <Tooltip content={isAllClasses ? 'Choisissez une classe pour imprimer sa feuille' : "Imprimer une feuille d'appel vierge, à remplir à la main"}>
                  <FloatButton
                    variant="secondary"
                    type="button"
                    onClick={handlePrintPdf}
                    disabled={isAllClasses}
                    size="mini"
                  >
                    Feuille vierge
                  </FloatButton>
                </Tooltip>
              </div>
              <div className="flex items-center gap-4 text-xs text-warm-700">
                <span>{summary.abs} absence{summary.abs > 1 ? 's' : ''} <span className="text-red-500 font-semibold">({summary.absNJ} NJ)</span></span>
                <span>{summary.ret} retard{summary.ret > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Tableau */}
            <div className="flex-1 overflow-y-auto">
              {isAllClasses ? (
                <div className="p-3 space-y-3">
                  {/* ── Comparaison des classes ───────────────────────────── */}
                  <table aria-label="Absences et retards par classe sur la période" className="w-full text-xs">
                    <thead className="bg-warm-50">
                      <tr className="text-[11px] text-warm-700 uppercase tracking-wide">
                        <th scope="col" className="text-left py-1 px-2 pl-3 font-semibold">Classe</th>
                        <th scope="col" className="text-center py-1 px-2 font-semibold w-16 whitespace-nowrap">{MOT_MAJ}s</th>
                        <th scope="col" className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Abs</th>
                        <th scope="col" className="text-center py-1 px-2 font-semibold w-16 whitespace-nowrap">Abs NJ</th>
                        <th scope="col" className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Ret</th>
                        <th scope="col" className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classStats.map(({ cls, effectif, abs, absNJ, ret }) => {
                        const info = classInfoLine(cls)
                        return (
                          /* Ligne cliquable : descente du global vers le détail
                             de la classe, règle de liste du projet. */
                          <tr
                            key={cls.id}
                            onClick={() => { setSelectedClassId(cls.id); setExpandedStudent(null) }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Ouvrir la classe ${cls.name}`}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSelectedClassId(cls.id)
                                setExpandedStudent(null)
                              }
                            }}
                            className="border-b border-warm-100 cursor-pointer hover:bg-warm-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                          >
                            <td className="py-1.5 px-2 pl-3">
                              <span className="font-semibold text-secondary-800">{cls.name}</span>
                              {info && <span className="text-warm-700"> · {info}</span>}
                            </td>
                            <td className="text-center py-1.5 px-2 tabular-nums text-warm-700">{effectif}</td>
                            <td className="text-center py-1.5 px-2 tabular-nums font-semibold text-secondary-800">{abs}</td>
                            <td className={clsx('text-center py-1.5 px-2 tabular-nums font-semibold', absNJ > 0 ? 'text-red-600' : 'text-warm-700')}>{absNJ}</td>
                            <td className="text-center py-1.5 px-2 tabular-nums text-amber-700">{ret}</td>
                            <td className="text-center py-1.5 px-2 tabular-nums font-bold text-secondary-800">{abs + ret}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* ── Élèves les plus absents, tous cours confondus ──────── */}
                  <section>
                    <h3 className="stat-label mb-1.5">{MOT_MAJ}s les plus absents · tous cours</h3>
                    {topAbsentStudents.length === 0 ? (
                      <p className="text-xs text-warm-700 italic py-3 text-center">Aucune absence sur la période.</p>
                    ) : (
                      <table aria-label={`${MOT_MAJ}s les plus absents sur la période`} className="w-full text-xs">
                        <thead className="bg-warm-50">
                          <tr className="text-[11px] text-warm-700 uppercase tracking-wide">
                            <th scope="col" className="text-left py-1 px-2 pl-3 font-semibold">{MOT_MAJ}</th>
                            <th scope="col" className="text-left py-1 px-2 font-semibold">Classe</th>
                            <th scope="col" className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Abs</th>
                            <th scope="col" className="text-center py-1 px-2 font-semibold w-16 whitespace-nowrap">Abs NJ</th>
                            <th scope="col" className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Ret</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topAbsentStudents.map(r => (
                            <tr key={r.student.student_id} className="border-b border-warm-100">
                              <td className="py-1.5 px-2 pl-3 font-semibold text-secondary-800">
                                {r.student.last_name} {r.student.first_name}
                                {r.absNJ >= ALERT_THRESHOLD && (
                                  <Tooltip content={`${r.absNJ} absences non justifiées`}>
                                    <AlertTriangle size={12} className="inline ml-1 text-red-500 align-[-1px]" aria-label="Seuil d'alerte atteint" />
                                  </Tooltip>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-warm-700">
                                {r.cls && (() => {
                                  const info = classInfoLine(r.cls)
                                  return info ? (
                                    <Tooltip content={info} maxWidth="max-w-none">
                                      <span className="cursor-help underline decoration-dotted decoration-warm-300 underline-offset-2">{r.cls.name}</span>
                                    </Tooltip>
                                  ) : <span>{r.cls.name}</span>
                                })()}
                              </td>
                              <td className="text-center py-1.5 px-2 tabular-nums font-semibold text-secondary-800">{r.abs}</td>
                              <td className={clsx('text-center py-1.5 px-2 tabular-nums font-semibold', r.absNJ > 0 ? 'text-red-600' : 'text-warm-700')}>{r.absNJ}</td>
                              <td className="text-center py-1.5 px-2 tabular-nums text-amber-700">{r.ret}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                </div>
              ) : classStudents.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-warm-700">Aucun {MOT} affecté à cette classe.</p>
                </div>
              ) : (
                <table aria-label="Récapitulatif des absences et retards par élève" className="w-full text-xs">
                  <thead className="sticky top-0 bg-warm-50 z-10">
                    <tr className="text-[11px] text-warm-700 uppercase tracking-wide">
                      <th className="text-left py-1 px-2 pl-3 font-semibold">Élèves</th>
                      <th className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Abs</th>
                      <th className="text-center py-1 px-2 font-semibold w-16 whitespace-nowrap">Abs NJ</th>
                      <th className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Ret</th>
                      <th className="text-center py-1 px-2 font-semibold w-14 whitespace-nowrap">Total</th>
                      <th className="text-center py-1 px-2 font-semibold w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map(s => {
                      const c = countsByStudent.get(s.student_id) ?? { abs: 0, absNJ: 0, ret: 0 }
                      const total = c.abs + c.ret
                      const isExpanded = expandedStudent === s.student_id
                      const studentAbsences = periodAbsences
                        .filter(a => a.student_id === s.student_id)
                        .sort((a, b) => a.absence_date.localeCompare(b.absence_date))
                      const hasAlert = c.absNJ >= ALERT_THRESHOLD

                      return (
                        <StudentRow
                          key={s.student_id}
                          student={s}
                          counts={c}
                          total={total}
                          hasAlert={hasAlert}
                          isExpanded={isExpanded}
                          absences={studentAbsences}
                          onToggle={() => setExpandedStudent(isExpanded ? null : s.student_id)}
                          onJustify={setJustifyTarget}
                          onRemoveJustification={handleRemoveJustification}
                          onDelete={handleDelete}
                        />
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modale Saisie ── */}
      {showSaisie && selectedClassId && !isAllClasses && selectedPeriodId && (
        <SaisieModal
          classStudents={classStudents}
          classInfo={classes.find(c => c.id === selectedClassId)!}
          classId={selectedClassId}
          periodId={selectedPeriodId}
          etablissementId={etablissementId}
          etablissement={etablissement}
          yearLabel={yearLabel}
          existingAbsences={absences.filter(a => a.class_id === selectedClassId)}
          validatedDates={validatedDates}
          mode={mode}
          onComplete={handleSaisieComplete}
          onClose={() => setShowSaisie(false)}
        />
      )}

      {/* ── Modale Justification ── */}
      {justifyTarget && (
        <JustificationModal
          absence={justifyTarget}
          studentName={(() => {
            const s = students.find(s => s.student_id === justifyTarget.student_id)
            return s ? `${s.last_name} ${s.first_name}` : ''
          })()}
          etablissementId={etablissementId}
          mode={mode}
          onComplete={handleJustifyComplete}
          onClose={() => setJustifyTarget(null)}
        />
      )}
    </div>
  )
}

// ─── Ligne élève + accordéon ─────────────────────────────────────────────────

function StudentRow({
  student, counts, total, hasAlert, isExpanded, absences,
  onToggle, onJustify, onRemoveJustification, onDelete,
}: {
  student: StudentRow
  counts: { abs: number; absNJ: number; ret: number }
  total: number
  hasAlert: boolean
  isExpanded: boolean
  absences: Absence[]
  onToggle: () => void
  onJustify: (a: Absence) => void
  onRemoveJustification: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmRemoveJustId, setConfirmRemoveJustId] = useState<string | null>(null)

  // Ouvre le justificatif : URL signee (bucket prive) ; valeur héritée en URL complete → directe.
  const openJustificatif = async (stored: string) => {
    if (stored.startsWith('http')) { window.open(stored, '_blank', 'noopener'); return }
    const supabase = createClient()
    const { data } = await supabase.storage.from('absence-justificatifs').createSignedUrl(stored, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${student.last_name} ${student.first_name}, voir le détail des absences`}
        className={clsx(
          'cursor-pointer transition-colors border-b border-warm-50',
          'focus:outline-none focus-visible:bg-primary-50',
          isExpanded ? 'bg-primary-50' : 'hover:bg-warm-50'
        )}
      >
        <td className="py-1 px-2 pl-3 font-medium text-secondary-700 flex items-center gap-1">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {student.last_name} {student.first_name}
        </td>
        <td className="text-center py-1 px-2">{counts.abs || '·'}</td>
        <td className={clsx('text-center py-1 px-2 font-semibold', counts.absNJ > 0 && 'text-red-600')}>{counts.absNJ || '·'}</td>
        <td className="text-center py-1 px-2">{counts.ret || '·'}</td>
        <td className="text-center py-1 px-2 font-semibold">{total || '·'}</td>
        <td className="text-center py-1 px-2">
          {hasAlert && <AlertTriangle size={12} className="text-amber-500 mx-auto" />}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-warm-50/50 px-3 py-2">
            {absences.length === 0 ? (
              <p className="text-xs text-warm-700 italic py-1">Aucune absence ou retard enregistré.</p>
            ) : (
              <div className="space-y-1">
                {absences.map(a => (
                  <div key={a.id} className="flex items-center gap-3 text-xs py-1 border-b border-warm-100 last:border-0">
                    <span className="font-mono text-warm-700 w-16 flex-shrink-0">{fmtDate(a.absence_date)}</span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[11px] font-semibold flex-shrink-0',
                      a.absence_type === 'absence'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    )}>
                      {a.absence_type === 'absence' ? 'Absence' : 'Retard'}
                    </span>
                    {a.comment && <span className="text-warm-700 truncate">{a.comment}</span>}
                    <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                      {a.is_justified ? (
                        <span className="flex items-center gap-1.5">
                          <span className="flex items-center gap-1 text-primary-600">
                            <FileCheck size={12} /> Justifié
                            {a.justification_date && <span className="text-warm-700">({fmtDate(a.justification_date)})</span>}
                          </span>
                          {a.justification_document_url && (
                            <button
                              onClick={e => { e.stopPropagation(); openJustificatif(a.justification_document_url!) }}
                              className="text-primary-500 hover:text-primary-700 font-semibold transition-colors"
                            >
                              Voir
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); onJustify(a) }}
                            className="text-primary-500 hover:text-primary-700 font-semibold transition-colors"
                          >
                            Modifier
                          </button>
                          {confirmRemoveJustId === a.id ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={e => { e.stopPropagation(); onRemoveJustification(a.id); setConfirmRemoveJustId(null) }}
                                className="text-red-600 font-semibold hover:text-red-800"
                              >
                                Confirmer ?
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); setConfirmRemoveJustId(null) }}
                                className="text-warm-700 hover:text-warm-700"
                              >
                                Annuler
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmRemoveJustId(a.id) }}
                              className="text-warm-700 hover:text-red-500 font-semibold transition-colors"
                            >
                              Retirer
                            </button>
                          )}
                        </span>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); onJustify(a) }}
                          className="text-primary-600 hover:text-primary-800 font-semibold transition-colors"
                        >
                          Justifier
                        </button>
                      )}
                      {confirmDeleteId === a.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); onDelete(a.id); setConfirmDeleteId(null) }}
                            className="text-red-600 font-semibold hover:text-red-800"
                          >
                            Confirmer ?
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                            className="text-warm-700 hover:text-warm-700"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteId(a.id) }}
                          aria-label={`Supprimer ${a.absence_type === 'absence' ? "l'absence" : 'le retard'} du ${fmtDate(a.absence_date)}`}
                          className="text-warm-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Modale Saisie ───────────────────────────────────────────────────────────

type SaisieEntry = {
  student_id: string
  status: 'present' | 'absence' | 'retard'
  comment: string
  existingId: string | null        // id de l'absence existante si déjà enregistrée
  existingType: AbsenceType | null // type original pour détecter les changements
}

function buildEntries(classStudents: StudentRow[], existingAbsences: Absence[], date: string): SaisieEntry[] {
  const dateAbsences = existingAbsences.filter(a => (a.absence_date ?? '').slice(0, 10) === date)
  return classStudents.map(s => {
    const existing = dateAbsences.find(a => a.student_id === s.student_id)
    if (existing) {
      return {
        student_id: s.student_id,
        status: existing.absence_type as 'absence' | 'retard',
        comment: existing.comment ?? '',
        existingId: existing.id,
        existingType: existing.absence_type,
      }
    }
    return { student_id: s.student_id, status: 'present' as const, comment: '', existingId: null, existingType: null }
  })
}

// ─── Carte photo trombinoscope ──────────────────────────────────────────────

function StudentPhoto({ student, size = 'md' }: { student: StudentRow; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-10 h-[53px]' : 'w-[78px] h-[104px]'
  if (student.photo_url) {
    return <Image src={student.photo_url} alt="" width={size === 'sm' ? 40 : 78} height={size === 'sm' ? 53 : 104} className={clsx(dim, 'object-cover rounded-md')} unoptimized />
  }
  if (student.gender === 'male') return <MaleAvatar className={clsx(dim, 'rounded-md')} />
  if (student.gender === 'female') return <FemaleAvatar className={clsx(dim, 'rounded-md')} />
  return <DefaultAvatar className={clsx(dim, 'rounded-md')} />
}

const STATUS_CYCLE: ('present' | 'absence' | 'retard')[] = ['present', 'absence', 'retard']

const STATUS_STYLE = {
  present: { border: 'border-primary-400', bg: 'bg-primary-50/50', badge: 'bg-primary-500', label: 'Present' },
  absence: { border: 'border-red-400',   bg: 'bg-red-50/50',   badge: 'bg-red-500',   label: 'Absent' },
  retard:  { border: 'border-amber-400', bg: 'bg-amber-50/50', badge: 'bg-amber-500', label: 'Retard' },
}

function SaisieModal({
  classStudents, classInfo, classId, periodId, etablissementId, etablissement, yearLabel,
  existingAbsences, validatedDates, mode, onComplete, onClose,
}: {
  classStudents: StudentRow[]
  classInfo: ClassRow
  classId: string
  periodId: string
  etablissementId: string
  etablissement: EtablissementInfo | null
  yearLabel: string | null
  existingAbsences: Absence[]
  validatedDates: Set<string>
  mode: ModeAppel
  onComplete: (added: Absence[], updated: Absence[], deletedIds: string[], savedDate: string) => void
  onClose: () => void
}) {
  const TABLE = tableAppel(mode)
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const [date,          setDate]          = useState(today)
  const [localAbsences, setLocalAbsences] = useState<Absence[]>(existingAbsences)
  const [entries,       setEntries]       = useState<SaisieEntry[]>(
    () => buildEntries(classStudents, existingAbsences, today)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [isSaved,      setIsSaved]      = useState(false)

  // Regle projet : fermeture par X / Annuler uniquement (ni Echap, ni clic hors fenetre).

  // Fetch fresh absences on mount pour avoir les données à jour (évite le cache stale)
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from(TABLE).select('*').eq('class_id', classId)
      if (data) {
        const fresh = data.map(r => normaliserAbsence(r, mode))
        setLocalAbsences(fresh)
        setEntries(buildEntries(classStudents, fresh, today))
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDateChange = (newDate: string) => {
    setDate(newDate)
    setEntries(buildEntries(classStudents, localAbsences, newDate))
    // `isSaved` concerne la date qu'on quitte : le garder autoriserait l'impression
    // d'une date vierge. L'etat « deja en base » de la nouvelle date vient d'`isEditMode`.
    setIsSaved(false)
  }

  const cycleStatus = (idx: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e
      const curIdx = STATUS_CYCLE.indexOf(e.status)
      const next = STATUS_CYCLE[(curIdx + 1) % 3]
      return { ...e, status: next }
    }))
  }

  const setEntry = (idx: number, status: 'present' | 'absence' | 'retard') => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, status } : e))
  }

  const setComment = (idx: number, comment: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, comment } : e))
  }

  // Compteurs
  const counts = entries.reduce(
    (acc, e) => {
      acc[e.status]++
      return acc
    },
    { present: 0, absence: 0, retard: 0 }
  )

  // Entrees a inserer / modifier / supprimer
  const toInsert = entries.filter(e => e.status !== 'present' && !e.existingId)
  const toUpdate = entries.filter(e => e.status !== 'present' && e.existingId && (
    e.status !== e.existingType || e.comment.trim() !== (localAbsences.find(a => a.id === e.existingId)?.comment ?? '')
  ))
  const toDelete = entries.filter(e => e.status === 'present' && e.existingId)
  const hasChanges = toInsert.length > 0 || toUpdate.length > 0 || toDelete.length > 0
  const isEditMode = entries.some(e => e.existingId) || validatedDates.has(date)

  // On n'imprime QUE ce qui est enregistre : une feuille imprimee avant validation
  // ne correspondrait pas a la base (document papier faux, et confusion ensuite).
  // NB : apres un enregistrement, `entries` ne recoit pas les nouveaux `existingId`,
  // donc `hasChanges` reste vrai — d'ou le test sur `isSaved` en premier.
  const canPrint = (isSaved || isEditMode) && !hasChanges
  const printBlockedReason = !canPrint
    ? (hasChanges
        ? "Enregistrez vos modifications avant d'imprimer"
        : 'Aucune saisie enregistrée pour cette date')
    : null
  // Rien a perdre : « Fermer ». Modifications en attente : « Annuler ».
  const closeLabel = !hasChanges && (isSaved || isEditMode) ? 'Fermer' : 'Annuler'

  // Absents + retards pour le recap
  const nonPresent = entries
    .map((e, idx) => ({ ...e, idx, student: classStudents[idx] }))
    .filter(e => e.status !== 'present')

  const handleSubmit = async () => {
    if (!hasChanges) return
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null

      let added: Absence[] = []
      let updated: Absence[] = []
      const deletedIds: string[] = []

      if (toInsert.length > 0) {
        const rows = toInsert.map(e => ({
          etablissement_id: etablissementId,
          // Clé unifiée reconvertie au dernier moment : `student_id` pour un élève,
          // `parent_id` + `tutor_number` pour un adulte.
          ...colonnesParticipant(mode, e.student_id),
          class_id:         classId,
          period_id:        periodId,
          absence_date:     date,
          absence_type:     e.status as AbsenceType,
          comment:          e.comment.trim() || null,
          is_justified:     false,
          recorded_by:      uid,
        }))
        const { data, error: err } = await supabase.from(TABLE).insert(rows).select()
        if (err) throw err
        added = (data ?? []).map(r => normaliserAbsence(r, mode))
      }

      for (const e of toUpdate) {
        const { data, error: err } = await supabase
          .from(TABLE)
          .update({ absence_type: e.status as AbsenceType, comment: e.comment.trim() || null })
          .eq('id', e.existingId!)
          .select()
          .single()
        if (err) throw err
        if (data) updated.push(normaliserAbsence(data, mode))
      }

      for (const e of toDelete) {
        const { error: err } = await supabase.from(TABLE).delete().eq('id', e.existingId!)
        if (err) throw err
        deletedIds.push(e.existingId!)
      }

      // Notifications parents (fire-and-forget).
      // JAMAIS en mode adulte : la route résout le foyer À PARTIR de l'élève
      // (`getParentByStudentId`), et un adulte n'en est pas un. Prévenir quelqu'un
      // de sa propre absence n'aurait de toute façon aucun sens.
      if (mode === 'students' && added.length > 0) {
        fetch('/api/notifications/absence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            absences: added.map(a => ({ id: a.id, student_id: a.student_id, class_id: a.class_id, absence_type: a.absence_type, absence_date: a.absence_date })),
            etablissement_id: etablissementId,
          }),
        }).catch((err) => console.error('[Absences] Échec notification absence:', err))
      }

      // Refleter les nouvelles donnees ET reconstruire les lignes de saisie : sans ce
      // rebuild, les lignes inserees gardent `existingId: null` et comptent eternellement
      // comme des ajouts en attente (le diff ne redescend jamais a zero).
      const nextAbsences = (() => {
        const afterDelete = localAbsences.filter(a => !deletedIds.includes(a.id))
        const afterUpdate = afterDelete.map(a => { const u = updated.find(u => u.id === a.id); return u ?? a })
        return [...afterUpdate, ...added]
      })()
      setLocalAbsences(nextAbsences)
      setEntries(buildEntries(classStudents, nextAbsences, date))
      onComplete(added, updated, deletedIds, date)
      setIsSaved(true)
      setIsSubmitting(false)
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de l\'enregistrement.')
      setIsSubmitting(false)
    }
  }

  const handlePrintSaisie = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    let y = margin

    const COLORS = {
      primary:   [80, 117, 131]   as [number, number, number],
      secondary: [46, 69, 80]     as [number, number, number],
      gray:      [120, 120, 120]  as [number, number, number],
      headerBg:  [240, 245, 248]  as [number, number, number],
      green:     [22, 163, 74]    as [number, number, number],
      red:       [220, 38, 38]    as [number, number, number],
      amber:     [217, 119, 6]    as [number, number, number],
    }

    // Logo
    if (etablissement?.logo_url) {
      try {
        const res = await fetch(etablissement.logo_url)
        if (res.ok) {
          const blob = await res.blob()
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          doc.addImage(base64, 'PNG', margin, y, 20, 20)
        }
      } catch { /* ignore */ }
    }

    const logoOffset = etablissement?.logo_url ? 25 : 0

    // En-tete a 12 points, aligne sur le titre (voir bulletinPdf.ts).
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.secondary)
    doc.text(etablissement?.nom ?? '', margin + logoOffset, y + 7)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    const infoLines: string[] = []
    if (etablissement?.adresse) infoLines.push(etablissement.adresse)
    if (etablissement?.telephone) infoLines.push(`Tél : ${etablissement.telephone}`)
    infoLines.forEach((line, i) => { doc.text(line, margin + logoOffset, y + 12 + i * 4) })

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.primary)
    doc.text("FEUILLE D'APPEL", pageWidth - margin, y + 7, { align: 'right' })

    if (yearLabel) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.gray)
      doc.text(yearLabel, pageWidth - margin, y + 12, { align: 'right' })
    }

    y += 25
    doc.setDrawColor(...COLORS.primary)
    doc.setLineWidth(0.8)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6

    doc.setFillColor(...COLORS.headerBg)
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F')

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.secondary)
    doc.text(`Classe : ${classInfo.name}`, margin + 4, y + 7)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.gray)
    const infoParts: string[] = []
    if (classInfo.main_teacher_name) {
      infoParts.push(classInfo.main_teacher_civilite ? `${classInfo.main_teacher_civilite} ${classInfo.main_teacher_name}` : classInfo.main_teacher_name)
    }
    if (classInfo.level) infoParts.push(`Niveau ${classInfo.level}`)
    const timeStr = [classInfo.start_time, classInfo.end_time].filter(Boolean).map(t => t!.slice(0, 5)).join('·')
    const schedule = [classInfo.day_of_week, timeStr].filter(Boolean).join(' ')
    if (schedule) infoParts.push(schedule)
    doc.text(infoParts.join(' · '), margin + 4, y + 14)

    y += 25
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.secondary)
    const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(`Date : ${dateLabel}`, margin, y)
    doc.text(`Effectif : ${classStudents.length} élève${classStudents.length > 1 ? 's' : ''}`, pageWidth - margin, y, { align: 'right' })
    y += 6

    const sortedEntries = classStudents
      .map((s, i) => ({ student: s, entry: entries[i] }))
      .sort((a, b) => a.student.last_name.localeCompare(b.student.last_name) || a.student.first_name.localeCompare(b.student.first_name))

    const statusLabel = (status: 'present' | 'absence' | 'retard', gender: string | null) => {
      const female = gender === 'female'
      if (status === 'present') return female ? 'PRÉSENTE' : 'PRÉSENT'
      if (status === 'absence') return female ? 'ABSENTE' : 'ABSENT'
      return 'RETARD'
    }

    const statusColor = (status: 'present' | 'absence' | 'retard'): [number, number, number] => {
      if (status === 'present') return COLORS.green
      if (status === 'absence') return COLORS.red
      return COLORS.amber
    }

    autoTable(doc, {
      startY: y,
      head: [['N°', 'Nom', 'Prénom', 'Statut', 'Commentaire']],
      body: sortedEntries.map((row, i) => [
        String(i + 1),
        row.student.last_name,
        row.student.first_name,
        statusLabel(row.entry.status, row.student.gender),
        row.entry.comment || '',
      ]),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30], lineColor: [200, 200, 200], lineWidth: 0.3 },
      headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { halign: 'center', cellWidth: 28 },
        4: { cellWidth: 'auto' },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const row = sortedEntries[data.row.index]
          if (!row) return
          const color = statusColor(row.entry.status)
          doc.setTextColor(...color)
          doc.setFont('helvetica', 'bold')
          const txt = statusLabel(row.entry.status, row.student.gender)
          doc.text(txt, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' })
          doc.setTextColor(30, 30, 30)
          doc.setFont('helvetica', 'normal')
        }
      },
      margin: { left: margin, right: margin },
    })

    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 180, 180)
      doc.text(
        `FEUILLE D'APPEL · ${classInfo.name} · ${dateLabel}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    }

    doc.save(`Feuille_appel_${classInfo.name.replace(/\s+/g, '_')}_${date}.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appel-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >

        {/* Header */}
        <div className="px-4 py-2 border-b border-warm-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <h3 id="appel-title" className="text-sm font-bold text-secondary-800 whitespace-nowrap">Feuille d'appel du</h3>
            <FloatInput
              label="Date"
              type="date"
              value={date}
              onChange={e => handleDateChange(e.target.value)}
              max={today}
              className="w-44"
            />
          </div>
          <div className="flex items-center gap-3">
            {/* Compteurs */}
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                <span className="text-warm-700">{counts.present}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-warm-700">{counts.absence}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-warm-700">{counts.retard}</span>
              </span>
            </div>
            <button onClick={onClose} aria-label="Fermer" className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Corps : trombinoscope + recap */}
        <div className="flex-1 min-h-0 flex overflow-hidden">

          {/* Panneau gauche : trombinoscope */}
          <div className="flex-1 min-w-0 overflow-y-auto p-3">
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
              {classStudents.map((s, idx) => {
                const entry = entries[idx]
                const style = STATUS_STYLE[entry.status]
                return (
                  <button
                    key={s.student_id}
                    type="button"
                    onClick={() => cycleStatus(idx)}
                    aria-label={`${s.last_name} ${s.first_name} : ${style.label}. Cliquer pour changer le statut.`}
                    className={clsx(
                      'relative flex flex-col items-center rounded-lg border-2 p-1.5 transition-all hover:shadow-md cursor-pointer select-none',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      style.border, style.bg
                    )}
                  >
                    {/* Photo */}
                    <div className="w-[60px] h-[80px] rounded-md overflow-hidden flex-shrink-0">
                      <StudentPhoto student={s} size="md" />
                    </div>
                    {/* Nom */}
                    <p className="text-[10px] font-semibold text-secondary-800 text-center leading-tight mt-1 line-clamp-2">
                      {s.last_name.toUpperCase()}
                    </p>
                    <p className="text-[10px] text-secondary-600 text-center leading-tight line-clamp-1">
                      {s.first_name}
                    </p>
                    {/* Badge statut */}
                    <span className={clsx(
                      'absolute top-1 right-1 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm',
                      style.badge
                    )}>
                      {entry.status === 'present' ? <Check size={10} /> : style.label[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Panneau droit : recapitulatif absents/retards */}
          <div className="w-72 flex-shrink-0 border-l border-warm-100 flex flex-col bg-warm-50/30">
            <div className="px-3 py-2 border-b border-warm-100 flex-shrink-0">
              <h4 className="text-xs font-bold text-warm-700 uppercase tracking-widest">
                Absences / Retards ({nonPresent.length})
              </h4>
            </div>

            <div className="flex-1 overflow-y-auto">
              {nonPresent.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-warm-700">
                  <Check size={24} />
                  <p className="text-xs">Tous presents</p>
                </div>
              ) : (
                <div className="divide-y divide-warm-100">
                  {nonPresent.map(({ student: s, status, comment, idx }) => (
                    <div key={s.student_id} className="px-3 py-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-[27px] rounded overflow-hidden flex-shrink-0">
                          <StudentPhoto student={s} size="sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-secondary-800 truncate">
                            {s.last_name} {s.first_name}
                          </p>
                        </div>
                        <span className={clsx(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                          status === 'absence' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {status === 'absence' ? 'Absent' : 'Retard'}
                        </span>
                      </div>

                      {/* Toggle type + commentaire */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEntry(idx, status === 'absence' ? 'retard' : 'absence')}
                          className="text-[10px] text-primary-600 hover:text-primary-800 font-medium"
                        >
                          {status === 'absence' ? 'Retard ?' : 'Absent ?'}
                        </button>
                        <span className="text-warm-700">|</span>
                        <button
                          type="button"
                          onClick={() => setEntry(idx, 'present')}
                          className="text-[10px] text-primary-600 hover:text-primary-800 font-medium"
                        >
                          Present
                        </button>
                      </div>

                      {editingComment === s.student_id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            autoFocus
                            value={comment}
                            onChange={e => setComment(idx, e.target.value)}
                            onBlur={() => setEditingComment(null)}
                            onKeyDown={e => e.key === 'Enter' && setEditingComment(null)}
                            placeholder="Commentaire..."
                            className="border border-warm-300 rounded-md text-[11px] py-0.5 px-1.5 w-full focus:outline-none focus:border-primary-400 bg-white"
                          />
                          {comment && (
                            <button
                              type="button"
                              onMouseDown={e => { e.preventDefault(); setComment(idx, ''); setEditingComment(null) }}
                              aria-label="Effacer le commentaire"
                              className="flex-shrink-0 text-warm-700 hover:text-red-500 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingComment(s.student_id)}
                            className={clsx(
                              'text-[10px] truncate flex-1 text-left',
                              comment
                                ? status === 'absence' ? 'text-red-600 font-medium' : 'text-amber-600 font-medium'
                                : 'text-warm-700 italic'
                            )}
                          >
                            {comment || '+ Ajouter un commentaire'}
                          </button>
                          {comment && (
                            <button
                              type="button"
                              onClick={() => setComment(idx, '')}
                              aria-label="Effacer le commentaire"
                              className="flex-shrink-0 text-warm-700 hover:text-red-500 transition-colors"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {error && (
          <p role="alert" className="text-xs text-red-600 bg-red-50 px-4 py-2 border-t border-red-200">{error}</p>
        )}

        <div className="px-4 py-2.5 border-t border-warm-100 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-warm-700">
            {!hasChanges
              ? 'Aucune modification'
              : [
                  toInsert.length > 0 && `${toInsert.length} ajout${toInsert.length > 1 ? 's' : ''}`,
                  toUpdate.length > 0 && `${toUpdate.length} modif${toUpdate.length > 1 ? 's' : ''}`,
                  toDelete.length > 0 && `${toDelete.length} retrait${toDelete.length > 1 ? 's' : ''}`,
                ].filter(Boolean).join(', ')
            }
          </span>
          <div className="flex gap-2">
            <Tooltip content={printBlockedReason ?? "Imprimer la feuille d'appel enregistrée de cette date"}>
              <span>
                <FloatButton
                  variant="secondary"
                  type="button"
                  onClick={handlePrintSaisie}
                  disabled={!canPrint}
                >
                  Imprimer la saisie
                </FloatButton>
              </span>
            </Tooltip>
            <FloatButton variant="secondary" type="button" onClick={onClose}>
              {closeLabel}
            </FloatButton>
            <FloatButton
              variant={isEditMode ? 'edit' : 'submit'}
              type="button"
              onClick={handleSubmit}
              disabled={isEditMode ? !hasChanges : counts.absence === 0 && counts.retard === 0}
              loading={isSubmitting}
            >
              {isEditMode ? 'Modifier' : 'Valider'}
            </FloatButton>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Modale Justification ────────────────────────────────────────────────────

function JustificationModal({
  absence, studentName, etablissementId, mode, onComplete, onClose,
}: {
  absence: Absence
  studentName: string
  etablissementId: string
  mode: ModeAppel
  onComplete: (updated: Absence) => void
  onClose: () => void
}) {
  const TABLE = tableAppel(mode)
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()
  const [justDate,    setJustDate]    = useState(absence.justification_date ?? today)
  const [comment,     setComment]     = useState(absence.justification_comment ?? '')
  const [file,        setFile]        = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Regle projet : fermeture par X / Annuler uniquement (ni Echap, ni clic hors fenetre).

  // Validation du justificatif (PDF ou image, max 5 Mo)
  const handleFileSelect = (f: File | null) => {
    if (!f) { setFile(null); return }
    if (!/\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)) {
      setError('Format non supporté (PDF ou image).'); return
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux (max 5 Mo).'); return
    }
    setError(null); setFile(f)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      let docUrl: string | null = absence.justification_document_url ?? null

      // Upload du justificatif si fourni. On stocke le CHEMIN (bucket prive) et on
      // genere une URL signee a la consultation — un getPublicUrl ne fonctionne pas ici.
      if (file) {
        const ext = file.name.split('.').pop() ?? 'pdf'
        const path = `${etablissementId}/${absence.id}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('absence-justificatifs')
          .upload(path, file, { upsert: true })
        if (uploadErr) throw uploadErr
        docUrl = path
      }

      const { data, error: updateErr } = await supabase
        .from(TABLE)
        .update({
          is_justified:              true,
          justification_date:        justDate,
          justification_comment:     comment.trim() || null,
          justification_document_url: docUrl,
        })
        .eq('id', absence.id)
        .select()
        .single()

      if (updateErr) throw updateErr
      onComplete(normaliserAbsence(data, mode))
    } catch (err: any) {
      setError(err?.message ?? 'Erreur lors de la justification.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="justif-title"
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
      >

        <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
          <h3 id="justif-title" className="text-sm font-bold text-secondary-800">{absence.is_justified ? 'Modifier la justification' : 'Justifier'}</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3">
          <p className="text-sm text-secondary-700">
            <span className="font-semibold">{studentName}</span>
            {' · '}
            <span className={absence.absence_type === 'absence' ? 'text-red-600' : 'text-amber-600'}>
              {absence.absence_type === 'absence' ? 'Absence' : 'Retard'}
            </span>
            {' du '}{fmtDate(absence.absence_date)}
          </p>

          <FloatInput
            label="Date de justification"
            type="date"
            value={justDate}
            onChange={e => setJustDate(e.target.value)}
          />

          <FloatInput
            label="Commentaire"
            type="text"
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Certificat médical, mot des parents…"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-warm-700 uppercase tracking-wide">
              Document justificatif
            </label>
            <div className="flex items-center gap-2">
              <FloatButton
                variant="secondary"
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs px-3 py-1.5"
              >
                {file ? 'Changer' : 'Importer'}
              </FloatButton>
              {file && <span className="text-xs text-warm-700 truncate">{file.name}</span>}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0] ?? null)} />
          </div>

          {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-warm-100 flex justify-end gap-2">
          <FloatButton variant="secondary" type="button" onClick={onClose}>Annuler</FloatButton>
          <FloatButton
            variant="submit"
            type="button"
            onClick={handleSubmit}
            loading={isSubmitting}
          >
            Valider
          </FloatButton>
        </div>
      </div>
    </div>
  )
}
