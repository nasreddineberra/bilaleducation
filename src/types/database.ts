// Types metier des lignes de la base, DERIVES des types generes
// (`src/types/supabase.ts`, `npm run types-db`) : la nullabilite et la liste des
// colonnes viennent de la base reelle, jamais d'une copie a la main.
// Les textes bornes par un CHECK y sont deja des unions, les colonnes jsonb a
// structure connue y portent leur forme (`./json`).

import type { Tables } from './supabase'

import type { DiagnosticOption } from './json'

export type { VacationPeriod, JourFerie, PaymentReference, DiagnosticOption } from './json'

// Unions de valeurs : lues par le generateur dans les CHECK de la base.

export type UserRole = Tables<'profiles'>['role']

export type Gender = NonNullable<Tables<'students'>['gender']>

export type TutorRelationship = NonNullable<Tables<'parents'>['tutor1_relationship']>

export type PeriodType = Tables<'school_years'>['period_type']

export type EvalTypeKind = Tables<'eval_type_configs'>['eval_type']

/** Parse un élément diagnostic_options (objet, chaîne JSON, ou simple string) */
export function parseDiagnosticOption(o: unknown): DiagnosticOption {
  if (typeof o === 'object' && o !== null && 'acronym' in o) return o as DiagnosticOption
  if (typeof o === 'string') {
    if (o.startsWith('{')) try { return JSON.parse(o) } catch { /* fallback */ }
    return { acronym: o, comment: '' }
  }
  return { acronym: String(o), comment: '' }
}

export type AbsenceType = Tables<'absences'>['absence_type']

export type WarningSeverity = Tables<'student_warnings'>['severity']

// `notes` a QUITTÉ `etablissements` : les observations commerciales de l'éditeur
// vivent dans `etablissement_notes`, hors de portée de l'école (la ligne
// d'`etablissements` est lisible par tous ses comptes).
export type Etablissement = Tables<'etablissements'>

// Passage d'année : l'état de clôture vit sur l'année elle-même. Une année peut
// être close tout en restant l'année EN COURS, jusqu'à l'activation de la suivante.
export type SchoolYear = Tables<'school_years'>

export type Period = Tables<'periods'>

export type EvalTypeConfig = Tables<'eval_type_configs'>

// `theme` NULL = clair (defaut).
export type Profile = Tables<'profiles'>

export type Student = Tables<'students'>

// `tutor1_email` est NOT NULL + CHECK non vide : c'est le seul canal de
// l'etablissement vers la famille.
export type Parent = Tables<'parents'>

export type Teacher = Tables<'teachers'>

export type TeacherDocument = Tables<'teacher_documents'>

export type Class = Tables<'classes'>

export type Absence = Tables<'absences'>

export type DocumentCategory = Tables<'student_documents'>['category']

export type UniteEnseignement = Tables<'unites_enseignement'>

export type CoursModule = Tables<'cours_modules'>

export type Cours = Tables<'cours'>

export type CotisationType = Tables<'cotisation_types'>

export type FeeStatus = Tables<'fee_installments'>['status']

export type AdjustmentType = Tables<'fee_adjustments'>['adjustment_type']

export type FeePaymentMethod = NonNullable<Tables<'fee_installments'>['payment_method']>

export type FeeAdjustment = Tables<'fee_adjustments'>

export type FeeInstallment = Tables<'fee_installments'>

// ─── Salles & Ressources matérielles ─────────────────────────────────────────

export type RoomType = Tables<'rooms'>['room_type']

export type MaterialCategory = Tables<'materials'>['category']

export type MaterialCondition = Tables<'materials'>['condition']

export type Room = Tables<'rooms'>

export type Material = Tables<'materials'>

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export type AuditAction = Tables<'audit_logs'>['action']

export type AuditLog = Tables<'audit_logs'>
