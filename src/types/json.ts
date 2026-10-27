// Forme des colonnes jsonb dont la structure est fixee par l'application.
// `npm run types-db` remplace leur type `Json` par celui-ci dans
// `src/types/supabase.ts` (Row, Insert, Update) : une cle de `ColonnesJson`
// = une colonne `table.colonne`. A tenir a jour quand une colonne jsonb change.

import type { Json } from './supabase'

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

export type ColonnesJson = {
  'school_years.vacations':             VacationPeriod[]
  'school_years.jours_feries':          JourFerie[]
  'fee_installments.payment_reference': PaymentReference
  'eval_type_configs.diagnostic_options': DiagnosticOption[]
  'audit_logs.old_data':                  EtatLigne
  'audit_logs.new_data':                  EtatLigne
}
