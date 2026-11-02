/**
 * REGISTRE DE L'AIDE INTEGREE : toutes les procedures, la procedure d'une page,
 * le filtrage par role et la recherche. Module pur (teste par `node --test`) :
 * aucun import par alias en valeur.
 */
import type { Procedure, RoleAide } from './types.ts'
import { reglements } from './procedures/reglements.ts'
import { situationFinanciere, statistiquesReglements, bilansAnnuels } from './procedures/financements.ts'
import { cotisations } from './procedures/cotisations.ts'
import { passageAnnee } from './procedures/passage-annee.ts'
import { absencesEnseignants } from './procedures/absences-enseignants.ts'
import { etablissement } from './procedures/etablissement.ts'

/** Ordre des modules dans le menu Aide : celui de la barre de navigation. */
export const ORDRE_MODULES = ['Principal', 'Vie scolaire', 'Pédagogie', 'Gestion', 'Clôture', 'Paramètres'] as const

export const PROCEDURES: Procedure[] = [
  reglements,
  situationFinanciere,
  statistiquesReglements,
  bilansAnnuels,
  cotisations,
  passageAnnee,
  absencesEnseignants,
  etablissement,
]

/** `admin` a les droits de `direction` partout (regle du projet). */
function roleAide(role: string | null | undefined): RoleAide | null {
  if (!role || role === 'super_admin' || role === 'parent') return null
  return (role === 'admin' ? 'direction' : role) as RoleAide
}

/** L'element (restreint ou non a des roles) concerne-t-il ce role ? */
export function concerne(roles: RoleAide[] | undefined, role: string | null | undefined): boolean {
  const r = roleAide(role)
  return !!r && (!roles || roles.includes(r))
}

/** La procedure telle que ce role doit la lire : ce qu'il ne peut jamais faire est retire. */
export function procedurePour(p: Procedure, role: string | null | undefined): Procedure | null {
  if (!concerne(p.roles, role)) return null
  const garder = <T extends { roles?: RoleAide[] }>(l?: T[]) => l?.filter(x => concerne(x.roles, role))
  return {
    ...p,
    taches: garder(p.taches) ?? [],
    regles: garder(p.regles),
    grise: garder(p.grise),
    faq: garder(p.faq),
  }
}

/** La page `chemin` correspond-elle a l'adresse `ecran` (exacte, ou prefixe `/*`) ? */
export function couvre(ecran: string, chemin: string): boolean {
  return ecran.endsWith('/*') ? chemin.startsWith(ecran.slice(0, -1)) : chemin === ecran
}

/** Procedure de la page en cours pour ce role, ou `null`. */
export function procedureDeLaPage(chemin: string, role: string | null | undefined): Procedure | null {
  const p = PROCEDURES.find(x => x.ecrans.some(e => couvre(e, chemin)))
  return p ? procedurePour(p, role) : null
}

export function procedureParSlug(slug: string, role: string | null | undefined): Procedure | null {
  const p = PROCEDURES.find(x => x.slug === slug)
  return p ? procedurePour(p, role) : null
}

/** Procedures lisibles par ce role, dans l'ordre des modules puis des titres. */
export function proceduresDuRole(role: string | null | undefined): Procedure[] {
  const rang = (m: string) => {
    const i = (ORDRE_MODULES as readonly string[]).indexOf(m)
    return i < 0 ? ORDRE_MODULES.length : i
  }
  return PROCEDURES
    .map(p => procedurePour(p, role))
    .filter((p): p is Procedure => !!p)
    .sort((a, b) => rang(a.module) - rang(b.module) || a.titre.localeCompare(b.titre, 'fr'))
}

/** Minuscules sans accents, pour une recherche tolerante. */
export function normaliser(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Tout le texte d'une procedure, pour la recherche. */
export function texteProcedure(p: Procedure): string {
  return [
    p.titre, p.module, p.resume, p.acces,
    ...p.taches.flatMap(t => [t.titre, ...t.etapes, ...(t.aSavoir ?? [])]),
    ...(p.regles ?? []).map(r => r.texte),
    ...(p.grise ?? []).flatMap(g => [g.element, g.raison, g.solution]),
    ...(p.faq ?? []).flatMap(f => [f.question, f.reponse]),
  ].join('\n')
}

/** Procedures dont le texte contient TOUS les mots cherches (2 caracteres minimum). */
export function rechercher(procedures: Procedure[], requete: string): Procedure[] {
  const mots = normaliser(requete).split(/\s+/).filter(m => m.length >= 2)
  if (mots.length === 0) return procedures
  return procedures.filter(p => {
    const t = normaliser(texteProcedure(p))
    return mots.every(m => t.includes(m))
  })
}

/** Decoupe un texte en segments, les noms entre « ... » marques `fort`. */
export function segments(texte: string): { texte: string; fort: boolean }[] {
  return texte.split(/(«[^»]*»)/).filter(Boolean).map(s => ({ texte: s, fort: s.startsWith('«') }))
}
