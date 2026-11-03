/**
 * REGISTRE DE L'AIDE INTEGREE : toutes les procedures, la procedure d'une page,
 * le filtrage par role et la recherche. Module pur (teste par `node --test`) :
 * aucun import par alias en valeur.
 */
import type { OptionAide, OptionsEcole, Procedure, RoleAide } from './types.ts'
import { reglements } from './procedures/reglements.ts'
import { situationFinanciere, statistiquesReglements, bilansAnnuels } from './procedures/financements.ts'
import { cotisations } from './procedures/cotisations.ts'
import { passageAnnee } from './procedures/passage-annee.ts'
import { absencesEnseignants } from './procedures/absences-enseignants.ts'
import { etablissement } from './procedures/etablissement.ts'
import { apprenants, parents, affectations } from './procedures/vie-scolaire.ts'
import { feuilleAppel, cahierTexte, emploiDuTemps, tempsPresence } from './procedures/pedagogie.ts'
import {
  anneesScolaires, utilisateurs, comptesParents, enseignants, classes, referentielCours, typesPresence, ressources, journalActivite,
} from './procedures/parametres.ts'
import { gabaritsEvaluations, saisieNotes, bulletins } from './procedures/evaluations.ts'
import {
  tableauDeBord, notifications, messageParents, messageEquipe, messagesEnvoyes, monCompte, support, importation,
  classesArchivees,
} from './procedures/general.ts'
import { miseEnRoute } from './procedures/mise-en-route.ts'

/** Ordre des modules dans le menu Aide : celui de la barre de navigation. */
export const ORDRE_MODULES = ['Principal', 'Vie scolaire', 'Pédagogie', 'Gestion', 'Clôture', 'Paramètres'] as const

/** Procedure de demarrage de la direction : en tete du menu Aide et du guide. */
export const SLUG_MISE_EN_ROUTE = 'mise-en-route'

// La PREMIERE procedure qui couvre une page l'emporte : `messageParents` et
// `messageEquipe` restent AVANT `messagesEnvoyes`, dont le `/*` couvre aussi
// leurs adresses.
export const PROCEDURES: Procedure[] = [
  miseEnRoute,
  tableauDeBord,
  notifications,
  monCompte,
  support,
  reglements,
  situationFinanciere,
  statistiquesReglements,
  bilansAnnuels,
  cotisations,
  passageAnnee,
  absencesEnseignants,
  etablissement,
  apprenants,
  parents,
  affectations,
  feuilleAppel,
  cahierTexte,
  emploiDuTemps,
  tempsPresence,
  importation,
  gabaritsEvaluations,
  saisieNotes,
  bulletins,
  classesArchivees,
  messageParents,
  messageEquipe,
  messagesEnvoyes,
  anneesScolaires,
  utilisateurs,
  comptesParents,
  enseignants,
  classes,
  referentielCours,
  typesPresence,
  ressources,
  journalActivite,
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

/** Ecole sans aucune option : valeur par defaut des lectures de l'aide. */
export const SANS_OPTION: OptionsEcole = { espaceFamille: false }

/** L'element (dependant ou non d'une option) existe-t-il dans cette ecole ? */
export function disponible(option: OptionAide | undefined, options: OptionsEcole): boolean {
  return !option || (option === 'espace_famille' && options.espaceFamille)
}

/** La procedure telle que ce role doit la lire : ce qu'il ne peut jamais faire est retire,
 *  comme ce qui depend d'une option que l'ecole n'a pas. */
export function procedurePour(p: Procedure, role: string | null | undefined, options: OptionsEcole = SANS_OPTION): Procedure | null {
  if (!concerne(p.roles, role) || !disponible(p.option, options)) return null
  const garder = <T extends { roles?: RoleAide[]; option?: OptionAide }>(l?: T[]) =>
    l?.filter(x => concerne(x.roles, role) && disponible(x.option, options))
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

/** Procedure de la page en cours pour ce role, ou `null`. Plusieurs procedures peuvent
 *  couvrir un ecran (roles ou options differents) : la PREMIERE lisible l'emporte. */
export function procedureDeLaPage(chemin: string, role: string | null | undefined, options: OptionsEcole = SANS_OPTION): Procedure | null {
  for (const x of PROCEDURES) {
    if (!x.ecrans.some(e => couvre(e, chemin))) continue
    const lisible = procedurePour(x, role, options)
    if (lisible) return lisible
  }
  return null
}

export function procedureParSlug(slug: string, role: string | null | undefined, options: OptionsEcole = SANS_OPTION): Procedure | null {
  const p = PROCEDURES.find(x => x.slug === slug)
  return p ? procedurePour(p, role, options) : null
}

/** Procedures lisibles par ce role, dans l'ordre des modules puis des titres. */
export function proceduresDuRole(role: string | null | undefined, options: OptionsEcole = SANS_OPTION): Procedure[] {
  const rang = (m: string) => {
    const i = (ORDRE_MODULES as readonly string[]).indexOf(m)
    return i < 0 ? ORDRE_MODULES.length : i
  }
  const premiere = (p: Procedure) => (p.slug === SLUG_MISE_EN_ROUTE ? 0 : 1)
  return PROCEDURES
    .map(p => procedurePour(p, role, options))
    .filter((p): p is Procedure => !!p)
    .sort((a, b) => premiere(a) - premiere(b) || rang(a.module) - rang(b.module) || a.titre.localeCompare(b.titre, 'fr'))
}

/** Roles cites dans la presentation des fonctionnalites, dans l'ordre des colonnes. */
export const ROLES_PRESENTATION: RoleAide[] = ['direction', 'responsable_pedagogique', 'secretaire', 'comptable', 'enseignant']

/**
 * Presentation de l'application (debut du guide PDF) : chaque fonctionnalite,
 * par module, avec les roles qui y accedent. Tiree des procedures (une
 * fonctionnalite = un ecran decrit), donc sans liste a tenir a part.
 */
export function presentationParModule(options: OptionsEcole = SANS_OPTION): { module: string; fonctionnalites: { titre: string; resume: string; roles: RoleAide[] }[] }[] {
  return ORDRE_MODULES
    .map(module => ({
      module,
      fonctionnalites: PROCEDURES
        .filter(p => p.module === module && p.slug !== SLUG_MISE_EN_ROUTE && disponible(p.option, options))
        .sort((a, b) => a.titre.localeCompare(b.titre, 'fr'))
        .map(p => ({ titre: p.titre, resume: p.resume, roles: p.roles })),
    }))
    .filter(m => m.fonctionnalites.length > 0)
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
