// Definition des etapes de cloture d'annee (ordre fige).
// Module ordinaire (isomorphe) : sert cote serveur (creation des lignes) ET
// cote client (libelles, ordre, type bloquant/avertissement).

export interface ClosureStepDef {
  key: string
  order: number
  label: string
  /** true = anomalie bloque la cloture de l'etape ; false = avertissement acquittable. */
  blocking: boolean
  description: string
  /** Lien vers le module pour corriger les anomalies. */
  href: string
}

export const CLOSURE_STEPS: ClosureStepDef[] = [
  { key: 'affectations',   order: 1, blocking: true,  label: 'Affectations & effectifs', description: 'Chaque élève actif est affecté à une classe de l’année.',                          href: '/dashboard/affectation' },
  { key: 'absences',       order: 2, blocking: false, label: 'Absences',                 description: 'Absences non justifiées encore en attente.',                                       href: '/dashboard/absences' },
  { key: 'notes',          order: 3, blocking: true,  label: 'Évaluations & notes',      description: 'Toutes les évaluations de l’année ont leurs notes (élèves et adultes).',           href: '/dashboard/grades' },
  { key: 'bulletins',      order: 4, blocking: true,  label: 'Bulletins',                description: 'Chaque participant a ses bulletins archivés pour toutes les périodes.',            href: '/dashboard/bulletins' },
  { key: 'temps_presence', order: 5, blocking: false, label: 'Temps de présence',        description: 'Saisies de présence du personnel complètes sur l’année.',                          href: '/dashboard/temps-presence' },
  { key: 'financements',   order: 6, blocking: false, label: 'Financements',             description: 'Foyers non soldés et trop-perçus (restent payables après clôture).',               href: '/dashboard/financements/reglements' },
]

export const CLOSURE_STEP_BY_KEY: Record<string, ClosureStepDef> =
  Object.fromEntries(CLOSURE_STEPS.map(s => [s.key, s]))
