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
