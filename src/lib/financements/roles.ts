// Roles autorises sur le module Financements — source unique.
//
// Doit rester aligne sur la RLS (`expenses`, `other_revenues`,
// `financement_communications`) : la garde de page est du confort, la RLS fait
// foi. Regle projet : `admin` a toujours les droits de `direction`.
//
// Module ordinaire (PAS 'use server') : un fichier 'use server' ne peut exporter
// que des fonctions async — y mettre cette constante provoquerait un 500.

import type { UserRole } from '@/types/database'

export const FINANCE_ROLES: UserRole[] = ['admin', 'direction', 'comptable']

export function isFinanceRole(role: string | null | undefined): boolean {
  return !!role && (FINANCE_ROLES as string[]).includes(role)
}

// Ecran Reglements SEUL : la secretaire y a les droits du comptable (15/11 :
// paiements, reductions, relances, decisions de depart). Le reste du module
// (Statistiques, Situation financiere, Bilans, Cotisations et regle de depart)
// reste a `FINANCE_ROLES`. Meme liste que la RLS (`family_fees`,
// `fee_installments`, `fee_adjustments`, `financement_communications`).
export const REGLEMENTS_ROLES: UserRole[] = [...FINANCE_ROLES, 'secretaire']

export function isReglementsRole(role: string | null | undefined): boolean {
  return !!role && (REGLEMENTS_ROLES as string[]).includes(role)
}
