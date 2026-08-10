'use client'

import { useState, useMemo } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { SearchField } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import type { UniteEnseignement, CoursModule, Cours } from '@/types/database'

/**
 * PROTOTYPE — le référentiel des cours en TROIS COLONNES.
 *
 * ┌─ CE QU'IL CORRIGE ──────────────────────────────────────────────────────┐
 * │ Dans l'arbre en service, la hiérarchie ne se lit qu'à un retrait de      │
 * │ quelques pixels : unité et module ont la même typographie, la même       │
 * │ pastille, les mêmes icônes au même endroit. Et le contenu réel — les     │
 * │ cours — n'apparaît qu'après deux dépliages : à l'ouverture, l'écran ne   │
 * │ montre presque rien.                                                     │
 * │                                                                          │
 * │ Trois niveaux, trois colonnes : chacun a sa place, et les cours sont     │
 * │ visibles en permanence.                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * LE POINT DUR : un cours peut pendre DIRECTEMENT à une unité (`module_id`
 * est nullable, `unite_enseignement_id` ne l'est pas). La colonne du milieu
 * n'est donc pas homogène. Elle range les modules d'abord, puis les cours
 * sans module dans un groupe nommé — la troisième colonne reste ainsi
 * homogène, ce qu'un mélange aurait détruit.
 *
 * Les actions sont INERTES : ce prototype se juge sur la lisibilité.
 */

type Selection = { ueId: string | null; moduleId: string | null; coursId: string | null }

// Normalisation de recherche : minuscules + accents retirés, comme l'arbre.
const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

const arStyle: React.CSSProperties = {
  fontFamily: 'var(--font-arabic), sans-serif', fontSize: '16px', lineHeight: 1.4,
}

/** Nombre de gabarits d'évaluation, pour l'année en cours. Rien à zéro. */
function Badge({ n, annee }: { n: number; annee: string | null }) {
  if (!n) return null
  return (
    <Tooltip
      maxWidth="max-w-none"
      content={
        <span className="whitespace-nowrap">
          {`Utilisé dans ${n} gabarit${n > 1 ? 's' : ''} d'évaluation`}
          {annee && <><br />{`en ${annee}`}</>}
        </span>
      }
    >
      <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-1.5 py-px rounded-full flex-shrink-0 tabular-nums cursor-default">
        {n}
      </span>
    </Tooltip>
  )
}

/**
 * Encadré : en-tête (titre · compte · bouton d'ajout) puis corps défilant.
 *
 * Trois cartes distinctes plutôt qu'une seule découpée : chaque niveau devient
 * un objet à part entière, avec sa propre bordure et son propre ombrage. Le
 * bouton d'ajout monte dans l'en-tête — en pied de carte, il flottait sans
 * appartenir à rien, exactement le défaut de l'arbre en service.
 */
function Encadre({
  titre, compte, actions, liste, className = '', children,
}: {
  titre: string; compte: number
  /** Un bouton par NATURE d'enfant. La colonne des modules en a deux, parce
   *  qu'une unité accueille des modules ET des cours directs : avec un seul
   *  bouton, une unité sans cours direct n'offrait AUCUN moyen d'en créer le
   *  premier — le groupe « Cours sans module » n'existant pas encore. */
  actions: { libelle: string; aria: string }[]
  /** Libellé de la liste de choix — porté par le CORPS, jamais par la carte :
   *  un `listbox` ne contient que des `option`, et l'en-tête porte un bouton. */
  liste: string
  className?: string; children: React.ReactNode
}) {
  return (
    <div className={`card p-0 flex flex-col overflow-hidden ${className}`}>
      <div className="h-9 flex items-center gap-2 px-3 border-b border-[var(--line)] bg-[var(--surface-sunken)] flex-shrink-0">
        <span className="list-th !px-0 !py-0">{titre}</span>
        <span className="text-[10px] text-[var(--ink-muted)] tabular-nums">{compte}</span>
        {/* Mini-boutons : libellé seul, jamais d'icône (règle du projet).
            L'`aria-label` porte la phrase entière, le bouton n'affichant qu'un
            mot. */}
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          {actions.map(a => (
            <button
              key={a.aria}
              type="button"
              aria-label={a.aria}
              className="text-[11px] font-semibold text-primary-700 border border-primary-600/40 hover:bg-primary-50 px-2 py-0.5 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              {a.libelle}
            </button>
          ))}
        </span>
      </div>
      <div role="listbox" aria-label={liste} className="flex-1 min-h-0 overflow-y-auto list-scroll py-1">
        {children}
      </div>
    </div>
  )
}

/** Ligne sélectionnable. `role=option` : une colonne EST une liste de choix. */
function Ligne({
  code, nomFr, nomAr, badge, actif, chevron, onSelect,
}: {
  code: string | null; nomFr: string; nomAr: string | null
  badge: React.ReactNode; actif: boolean; chevron: boolean
  onSelect: () => void
}) {
  return (
    <div
      role="option"
      aria-selected={actif}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={[
        'group mx-1 px-2 py-1 rounded-lg cursor-pointer flex items-center gap-2 outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary-500/50 transition-colors',
        actif ? 'bg-primary-50' : 'hover:bg-[var(--surface-sunken)]',
      ].join(' ')}
    >
      {code && (
        <span className="text-[10px] font-mono text-[var(--ink-muted)] bg-[var(--line)] px-1 py-px rounded flex-shrink-0">
          {code}
        </span>
      )}

      {/* Le nom occupe l'espace restant : la pastille et les actions tiennent le
          bord droit, mais le nom ne les laisse pas s'en éloigner de 1 200 px
          comme dans l'arbre, où l'œil devait faire l'aller-retour. */}
      <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
        <span className={`text-sm truncate ${actif ? 'font-semibold text-primary-800' : 'font-medium text-[var(--ink)]'}`}>
          {nomFr}
        </span>
        {nomAr && (
          <span dir="rtl" className="text-[var(--ink-muted)] truncate flex-shrink-0" style={arStyle}>{nomAr}</span>
        )}
      </span>

      {badge}

      {/* Actions révélées au survol ET au focus clavier — sans `group-focus-within`
          elles resteraient inatteignables sans souris. */}
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0">
        <Tooltip content="Modifier">
          <button type="button" aria-label={`Modifier ${nomFr}`} className="p-1 text-[var(--ink-muted)] hover:text-primary-600 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
            <Pencil size={12} />
          </button>
        </Tooltip>
        <Tooltip content="Supprimer">
          <button type="button" aria-label={`Supprimer ${nomFr}`} className="p-1 text-[var(--ink-muted)] hover:text-red-500 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-400/60">
            <Trash2 size={12} />
          </button>
        </Tooltip>
      </span>

      {/* Le chevron dit « cette ligne a une suite à droite » — le seul repère
          qui manquait à l'arbre pour distinguer un module d'un cours. */}
      {chevron && <span className="text-[var(--ink-muted)] text-xs flex-shrink-0 select-none">›</span>}
    </div>
  )
}

function Vide({ texte }: { texte: string }) {
  return <p className="px-3 py-6 text-xs text-[var(--ink-muted)] text-center">{texte}</p>
}

export default function ReferentielColonnes({
  ues, modules, cours, gabaritsParCours, anneeLabel,
}: {
  ues: UniteEnseignement[]
  modules: CoursModule[]
  cours: Cours[]
  gabaritsParCours: Record<string, number>
  anneeLabel: string | null
}) {
  const [sel, setSel] = useState<Selection>({ ueId: null, moduleId: null, coursId: null })
  const [search, setSearch] = useState('')

  const q = norm(search)
  const matche = (...champs: (string | null | undefined)[]) =>
    !q || champs.some(c => norm(c).includes(q))

  // Somme des gabarits d'un ensemble de cours — sert aux trois niveaux.
  const somme = (liste: Cours[]) => liste.reduce((t, c) => t + (gabaritsParCours[c.id] ?? 0), 0)

  // La recherche ne filtre pas les trois colonnes indépendamment : elle garde
  // une unité si elle-même OU l'un de ses descendants correspond. Sinon on
  // cherche un cours et l'unité qui le porte disparaît, ce qui le rend
  // inatteignable.
  const uesFiltrees = useMemo(() => {
    if (!q) return ues
    return ues.filter(ue => {
      const sesModules = modules.filter(m => m.unite_enseignement_id === ue.id)
      const sesCours   = cours.filter(c => c.unite_enseignement_id === ue.id)
      return matche(ue.nom_fr, ue.nom_ar, ue.code)
        || sesModules.some(m => matche(m.nom_fr, m.nom_ar, m.code))
        || sesCours.some(c => matche(c.nom_fr, c.nom_ar, c.code))
    })
  }, [ues, modules, cours, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const ueActive     = sel.ueId
  const modulesDeUE  = modules.filter(m => m.unite_enseignement_id === ueActive)
  const coursDirects = cours.filter(c => c.unite_enseignement_id === ueActive && !c.module_id)
  const coursDuModule = cours.filter(c => c.module_id === sel.moduleId)
  const coursDeUE     = cours.filter(c => c.unite_enseignement_id === ueActive)

  // Colonne 3 : les cours du module choisi, ou les cours directs quand c'est le
  // groupe « sans module » qui est sélectionné (`moduleId` vaut alors la
  // sentinelle ci-dessous).
  const SANS_MODULE = '__directs__'
  const coursAffiches = sel.moduleId === SANS_MODULE ? coursDirects : coursDuModule

  return (
    <div className="space-y-2">
      {/* Bandeau d'avertissement : cette page est un prototype. */}
      <div className="card px-3 py-2 flex items-center gap-3 border-l-4 border-l-orange-400">
        <span className="text-xs text-[var(--ink)]">
          <strong>Page de test.</strong> Prototype du référentiel en trois colonnes, sur données
          réelles. Les boutons Ajouter / Modifier / Supprimer sont inertes.
        </span>
        <a href="/dashboard/cours" className="ml-auto text-xs font-medium text-primary-700 hover:text-primary-800 flex-shrink-0">
          Voir l&rsquo;écran actuel
        </a>
      </div>

      <div className="card px-3 py-2 flex items-center gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une unité, un module, un cours…"
          ariaLabel="Rechercher dans le référentiel"
        />
      </div>

      {/* Hauteur bornée : ce sont les ENCADRÉS qui défilent, jamais la page —
          sinon les trois en-têtes disparaîtraient au premier défilement.
          Les deux premiers se règlent sur leur contenu (`w-fit`), le troisième
          prend ce qui reste (`flex-1`), avec un plafond de largeur pour qu'un
          libellé exceptionnellement long ne déséquilibre pas la rangée. */}
      <div className="flex gap-3 items-stretch h-[calc(100vh-15rem)] min-h-[24rem]" role="group" aria-label="Référentiel des cours">

        {/* ── Encadré 1 : unités ───────────────────────────────────────────── */}
        <div className="flex">
          <Encadre
            titre="Unités"
            compte={uesFiltrees.length}
            actions={[{ libelle: 'Ajouter', aria: 'Ajouter une unité' }]}
            liste="Unités d'enseignement"
            className="w-fit min-w-[13rem] max-w-[24rem]"
          >
            {uesFiltrees.length === 0
              ? <Vide texte={q ? 'Aucun résultat.' : 'Aucune unité.'} />
              : uesFiltrees.map(ue => (
                  <Ligne
                    key={ue.id}
                    code={ue.code} nomFr={ue.nom_fr} nomAr={ue.nom_ar}
                    badge={<Badge n={somme(cours.filter(c => c.unite_enseignement_id === ue.id))} annee={anneeLabel} />}
                    actif={sel.ueId === ue.id}
                    chevron
                    onSelect={() => setSel({ ueId: ue.id, moduleId: null, coursId: null })}
                  />
                ))}
          </Encadre>
        </div>

        {/* ── Encadré 2 : modules, puis cours sans module ───────────────────── */}
        <div className="flex">
          <Encadre
            titre="Modules"
            compte={modulesDeUE.length + (coursDirects.length ? 1 : 0)}
            actions={ueActive ? [
              { libelle: 'Module', aria: 'Ajouter un module à cette unité' },
              { libelle: 'Cours',  aria: 'Ajouter un cours directement à cette unité' },
            ] : []}
            liste="Modules de l'unité"
            className="w-fit min-w-[14rem] max-w-[26rem]"
          >
            {!ueActive ? (
              <Vide texte="Sélectionnez une unité." />
            ) : (
              <>
                {modulesDeUE.map(m => (
                  <Ligne
                    key={m.id}
                    code={m.code} nomFr={m.nom_fr} nomAr={m.nom_ar}
                    badge={<Badge n={somme(cours.filter(c => c.module_id === m.id))} annee={anneeLabel} />}
                    actif={sel.moduleId === m.id}
                    chevron
                    onSelect={() => setSel(s => ({ ...s, moduleId: m.id, coursId: null }))}
                  />
                ))}

                {/* Les cours SANS module. Groupés et nommés plutôt que mêlés
                    aux modules : sans ça, la colonne mélangerait deux natures
                    et la troisième deviendrait imprévisible. */}
                {coursDirects.length > 0 && (
                  <div role="group" aria-label="Cours sans module">
                    <p aria-hidden="true" className="list-th !py-1 mt-1 border-t border-[var(--line)] pt-2">
                      Cours sans module
                    </p>
                    <Ligne
                      code={null}
                      nomFr={`${coursDirects.length} cours rattaché${coursDirects.length > 1 ? 's' : ''} à l'unité`}
                      nomAr={null}
                      badge={<Badge n={somme(coursDirects)} annee={anneeLabel} />}
                      actif={sel.moduleId === SANS_MODULE}
                      chevron
                      onSelect={() => setSel(s => ({ ...s, moduleId: SANS_MODULE, coursId: null }))}
                    />
                  </div>
                )}

                {modulesDeUE.length === 0 && coursDirects.length === 0 && (
                  <Vide texte="Cette unité est vide." />
                )}
              </>
            )}
          </Encadre>
        </div>

        {/* ── Encadré 3 : cours, il prend tout le reste ─────────────────────── */}
        <div className="flex-1 min-w-0 flex">
          <Encadre
            titre="Cours"
            compte={sel.moduleId ? coursAffiches.length : coursDeUE.length}
            actions={sel.moduleId ? [{ libelle: 'Ajouter', aria: 'Ajouter un cours' }] : []}
            liste="Cours du module"
            className="flex-1 min-w-0"
          >
            {!ueActive ? (
              <Vide texte="Sélectionnez une unité." />

            /* ── VUE D'ENSEMBLE DE L'UNITÉ ─────────────────────────────────
               Tant qu'aucun module n'est choisi, la colonne montrait « Sélectionnez
               un module » — un tiers de l'écran vide, et aucun moyen de voir d'un
               coup ce que porte l'unité. C'est le prix des colonnes en cascade, et
               il n'a pas à être payé ici : on affiche TOUS les cours de l'unité,
               groupés par module. Choisir un module ne fait alors que resserrer. */
            ) : !sel.moduleId ? (
              coursDeUE.length === 0
                ? <Vide texte="Cette unité ne contient aucun cours." />
                : (
                  <>
                    {modulesDeUE.map(m => {
                      const liste = cours.filter(c => c.module_id === m.id)
                      if (!liste.length) return null
                      return (
                        <div key={m.id} role="group" aria-label={m.nom_fr}>
                          <p aria-hidden="true" className="list-th !py-1 mt-1 first:mt-0">{m.nom_fr}</p>
                          {liste.map(c => (
                            <Ligne
                              key={c.id}
                              code={c.code} nomFr={c.nom_fr} nomAr={c.nom_ar}
                              badge={<Badge n={gabaritsParCours[c.id] ?? 0} annee={anneeLabel} />}
                              actif={sel.coursId === c.id}
                              chevron={false}
                              onSelect={() => setSel(s => ({ ...s, coursId: c.id }))}
                            />
                          ))}
                        </div>
                      )
                    })}
                    {coursDirects.length > 0 && (
                      <div role="group" aria-label="Cours sans module">
                        <p aria-hidden="true" className="list-th !py-1 mt-1 first:mt-0">Sans module</p>
                        {coursDirects.map(c => (
                          <Ligne
                            key={c.id}
                            code={c.code} nomFr={c.nom_fr} nomAr={c.nom_ar}
                            badge={<Badge n={gabaritsParCours[c.id] ?? 0} annee={anneeLabel} />}
                            actif={sel.coursId === c.id}
                            chevron={false}
                            onSelect={() => setSel(s => ({ ...s, coursId: c.id }))}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )

            ) : coursAffiches.length === 0 ? (
              <Vide texte="Ce module ne contient aucun cours." />
            ) : (
              coursAffiches.map(c => (
                <Ligne
                  key={c.id}
                  code={c.code} nomFr={c.nom_fr} nomAr={c.nom_ar}
                  badge={<Badge n={gabaritsParCours[c.id] ?? 0} annee={anneeLabel} />}
                  actif={sel.coursId === c.id}
                  chevron={false}
                  onSelect={() => setSel(s => ({ ...s, coursId: c.id }))}
                />
              ))
            )}
          </Encadre>
        </div>

      </div>
    </div>
  )
}
