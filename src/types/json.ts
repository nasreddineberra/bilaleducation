// Forme des colonnes jsonb dont la structure est fixee par l'application.
// `npm run types-db` remplace leur type `Json` par celui-ci dans
// `src/types/supabase.ts` (Row, Insert, Update) : une cle de `ColonnesJson`
// = une colonne `table.colonne`. A tenir a jour quand une colonne jsonb change.

import type { Json } from './supabase'
import type { DecisionAjustement } from '@/lib/financements/compute'
import type { AuditResult } from '@/lib/closure/audits'

/** Etat d'une ligne (avant / apres) au journal d'activite : `to_jsonb(ligne)`. */
export type EtatLigne = { [colonne: string]: Json | undefined }

export type VacationPeriod = {
  start_date: string
  end_date:   string
  label:      string
}

/**
 * Jour ferie : une JOURNEE isolee, a distinguer des semaines de `vacations`.
 * Saisi a la main — les fetes lunaires ne se calculent pas a l'avance.
 */
export type JourFerie = {
  date:  string   // AAAA-MM-JJ
  label: string
}

/** Option d'une evaluation diagnostique, ex. { acronym: 'AC', comment: 'Acquis Consolidé' }. */
export type DiagnosticOption = {
  acronym: string
  comment: string
}

/** Cheque, virement, paiement en ligne : la reference qui va avec le moyen. */
export type PaymentReference = {
  check_number?: string
  bank?: string
  transaction_id?: string
  reference?: string
  provider?: string
  payment_intent_id?: string
}

// ── Historique fige au passage d'annee (`lib/closure/archive.ts`) ────────────

/** Bulletin archive d'un participant (`student_year_history.bulletin_refs`). */
export type ArchiveBulletin = {
  period_label: string
  archive_id:   string
  file_path:    string
}

/** Paiement d'un foyer (`family_year_finance.installments_json`). */
export type ArchivePaiement = {
  date:      string | null
  montant:   number
  moyen:     string | null
  reference: string | null
}

/** Reduction ou majoration d'un foyer (`family_year_finance.adjustments_json`). */
export type ArchiveAjustement = {
  type:    string
  label:   string | null
  montant: number
  date:    string | null
}

/** Cotisation d'un participant ; un depart porte sa date et sa regle. */
export type ArchiveCotisation = {
  participant:      string
  cotisation_label: string | null
  total:            number
  date_depart?:     string | null
  regle?:           DecisionAjustement | 'a_decider' | null
}

/** Titulaire (ou remplacant) d'une classe sur une periode (`class_year_history`). */
export type ArchivePeriode = {
  nom: string
  du:  string | null
  au:  string | null
}

/** Creneau d'une classe : jour en toutes lettres, heures `HH:MM`. */
export type ArchiveCreneau = {
  jour:  string | null
  debut: string | null
  fin:   string | null
  salle: string | null
  du:    string | null
  au:    string | null
}

/** Participant d'une classe (`class_year_history.participants`). */
export type ArchiveParticipant = {
  type:   'eleve' | 'adulte'
  nom:    string
  prenom: string
  numero: string | null
}

export type ColonnesJson = {
  'school_years.vacations':             VacationPeriod[]
  'school_years.jours_feries':          JourFerie[]
  'fee_installments.payment_reference': PaymentReference
  'eval_type_configs.diagnostic_options': DiagnosticOption[]
  'audit_logs.old_data':                  EtatLigne
  'audit_logs.new_data':                  EtatLigne
  'student_year_history.bulletin_refs':   ArchiveBulletin[]
  'family_year_finance.installments_json': ArchivePaiement[]
  'family_year_finance.adjustments_json':  ArchiveAjustement[]
  'family_year_finance.cotisations_json':  ArchiveCotisation[]
  'class_year_history.titulaires':        ArchivePeriode[]
  'class_year_history.remplacements':     ArchivePeriode[]
  'class_year_history.creneaux':          ArchiveCreneau[]
  'class_year_history.participants':      ArchiveParticipant[]
  'year_audits.recap_json':               AuditResult
}
