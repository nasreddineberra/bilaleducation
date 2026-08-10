'use client'

import { useState, useMemo, useEffect } from 'react'
import { Pencil, Trash2, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SearchField, FloatInput, FloatButton } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Tooltip from '@/components/ui/Tooltip'
import type { UniteEnseignement, CoursModule, Cours } from '@/types/database'

/**
 * Le référentiel des cours, en TROIS COLONNES.
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
 * LA COULEUR D'UNE UNITÉ N'EST PLUS ÉDITABLE ICI. Elle ne servait qu'à la
 * palette de matières de l'emploi du temps, neutralisée avec le mode Secondaire
 * (`isDndActive = false`), et la piste des bandes teintées a été écartée après
 * mesure. La colonne reste en base pour le jour où le Secondaire reviendrait.
 *
 * LE POINT DUR : un cours peut pendre DIRECTEMENT à une unité (`module_id`
 * est nullable, `unite_enseignement_id` ne l'est pas). La colonne du milieu
 * n'est donc pas homogène. Elle range les modules d'abord, puis les cours
 * sans module dans un groupe nommé — la troisième colonne reste ainsi
 * homogène, ce qu'un mélange aurait détruit.
 */

type Selection = { ueId: string | null; moduleId: string | null; coursId: string | null }

/**
 * Ce qu'emporte une suppression, calculé AVANT de la proposer.
 *
 * L'écran ne fait qu'ANNONCER : la barrière vit en base
 * (`guard-referentiel-delete.sql`), les clés étant en RESTRICT et un
 * déclencheur refusant un cours qui sert un gabarit de l'année en cours. La
 * suppression partant du navigateur, un contrôle d'écran ne protégerait rien.
 */
type Emplacement = { classe: string; periode: string }

type DeleteDeps =
  | { etat: 'calcul' }
  | {
      etat: 'pret'
      motifBlocage: string | null
      avertissements: string[]
      /** Où le cours est encore utilisé. Dire COMBIEN sans dire OÙ laisse
       *  l'utilisateur chercher : le tableau lui épargne la fouille. */
      emplacements: Emplacement[]
    }

// Normalisation de recherche : minuscules + accents retirés, comme l'arbre.
const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

const arStyle: React.CSSProperties = {
  // Interlignage figé sur celui de `text-sm` : sans ça, l'arabe — plus grand
  // parce que sa hauteur de caractères est plus faible — impose une boîte de
  // 22 px et gonfle chaque ligne. Même remède que `arInputStyle` dans l'arbre.
  fontFamily: 'var(--font-arabic), sans-serif', fontSize: '16px', lineHeight: '1.25rem',
}

/**
 * Surligne la portion cherchée. Repris de l'arbre qu'écran remplace : `norm()`
 * conserve la LONGUEUR du texte (un accent reste un caractère + un diacritique retiré),
 * donc les indices calculés sur la version normalisée s'appliquent tels quels
 * au texte d'origine — c'est ce qui permet de surligner « écr » en tapant
 * « ecr ».
 */
function Surligne({ text, query }: { text: string; query: string }) {
  const nq = norm(query.trim())
  if (!nq) return <>{text}</>
  const nt = norm(text)
  const out: React.ReactNode[] = []
  let i = 0, key = 0
  while (i <= text.length) {
    const idx = nt.indexOf(nq, i)
    if (idx === -1) {
      if (i < text.length) out.push(<span key={key++}>{text.slice(i)}</span>)
      break
    }
    if (idx > i) out.push(<span key={key++}>{text.slice(i, idx)}</span>)
    out.push(
      <mark key={key++} className="bg-amber-200 text-amber-900 rounded-sm not-italic px-px">
        {text.slice(idx, idx + nq.length)}
      </mark>
    )
    i = idx + nq.length
  }
  return <>{out}</>
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
  actions: { libelle: string; aria: string; onClick: () => void }[]
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
        {/* `size="mini"` — la taille réduite du projet, désormais portée par
            `FloatButton` au lieu d'être recopiée à la main. La variante reste
            `submit` : c'est celle des actions de création, là où Règlements
            emploie `secondary` pour de simples raccourcis. */}
        <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {actions.map(a => (
            <FloatButton
              key={a.aria} type="button" variant="submit"
              size="mini"
              aria-label={a.aria} onClick={a.onClick}
            >
              {a.libelle}
            </FloatButton>
          ))}
        </span>
      </div>
      <div role="listbox" aria-label={liste} className="flex-1 min-h-0 overflow-y-auto list-scroll py-1">
        {children}
      </div>
    </div>
  )
}

/**
 * Ligne sélectionnable ET déplaçable. `role=option` : une colonne EST une liste
 * de choix.
 *
 * Le déplacement passe par une POIGNÉE et non par le corps de la ligne : celui-ci
 * sert déjà à sélectionner, et un même geste ne peut pas faire deux choses. La
 * poignée n'apparaît qu'au survol pour ne pas alourdir la lecture.
 *
 * Le glisser-déposer ne fait que RÉORDONNER, jamais déplacer d'un module à
 * l'autre — décision de l'utilisateur : un dépôt manqué changerait alors la
 * structure au lieu de l'ordre.
 */
function Ligne({
  id, code, nomFr, nomAr, badge, actif, chevron, onSelect, triable = true, q = '',
  onEditer, onSupprimer,
}: {
  /** Absents sur les lignes qui ne sont pas de vraies entités. */
  onEditer?: () => void
  onSupprimer?: () => void
  id: string
  /** Recherche en cours, pour le surlignage. */
  q?: string
  /** `false` pour les lignes qui ne sont pas de vraies entités — le groupe
   *  « Cours sans module » n'est pas un module, il n'a pas d'ordre à changer.
   *  Le crochet est appelé quoi qu'il arrive (règle des hooks), simplement
   *  désactivé, et la poignée disparaît. */
  triable?: boolean
  code: string | null; nomFr: string; nomAr: string | null
  badge: React.ReactNode; actif: boolean; chevron: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !triable })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      role="option"
      aria-selected={actif}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      className={[
        'group mx-1 px-1 py-0.5 rounded-md cursor-pointer flex items-center gap-1.5 outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary-500/50 transition-colors',
        actif ? 'bg-primary-50' : 'hover:bg-[var(--surface-sunken)]',
      ].join(' ')}
    >
      {triable && <button
        type="button"
        aria-label={`Déplacer ${nomFr}`}
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-[var(--ink-muted)] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded"
      >
        <GripVertical size={11} />
      </button>}
      {code && (
        <span className="text-[10px] font-mono text-[var(--ink-muted)] bg-[var(--line)] px-1 py-px rounded flex-shrink-0">
          <Surligne text={code} query={q} />
        </span>
      )}

      {/* Le nom occupe l'espace restant : la pastille et les actions tiennent le
          bord droit, mais le nom ne les laisse pas s'en éloigner de 1 200 px
          comme dans l'arbre, où l'œil devait faire l'aller-retour. */}
      <span className="flex-1 min-w-0 flex items-baseline gap-1.5">
        <span className={`text-sm truncate ${actif ? 'font-semibold text-primary-800' : 'font-medium text-[var(--ink)]'}`}>
          <Surligne text={nomFr} query={q} />
        </span>
        {nomAr && (
          <span dir="rtl" className="text-[var(--ink-muted)] truncate flex-shrink-0" style={arStyle}><Surligne text={nomAr} query={q} /></span>
        )}
      </span>

      {badge}

      {/* Actions révélées au survol ET au focus clavier — sans `group-focus-within`
          elles resteraient inatteignables sans souris. */}
      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex-shrink-0">
        {onEditer && (
          <Tooltip content="Modifier">
            <button
              type="button" aria-label={`Modifier ${nomFr}`}
              onClick={e => { e.stopPropagation(); onEditer() }}
              className="p-1 text-[var(--ink-muted)] hover:text-primary-600 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <Pencil size={12} />
            </button>
          </Tooltip>
        )}
        {onSupprimer && (
          <Tooltip content="Supprimer">
            <button
              type="button" aria-label={`Supprimer ${nomFr}`}
              onClick={e => { e.stopPropagation(); onSupprimer() }}
              className="p-1 text-[var(--ink-muted)] hover:text-red-500 rounded outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            >
              <Trash2 size={12} />
            </button>
          </Tooltip>
        )}
      </span>

      {/* Le chevron dit « cette ligne a une suite à droite » — le seul repère
          qui manquait à l'arbre pour distinguer un module d'un cours. */}
      {chevron && <span className="text-[var(--ink-muted)] text-xs flex-shrink-0 select-none">›</span>}
    </div>
  )
}

/**
 * Enveloppe de tri d'une liste. Une par liste — chaque colonne et chaque carte
 * a la sienne, ce qui interdit STRUCTURELLEMENT de faire passer un élément
 * d'une liste à l'autre : le glisser-déposer ne peut que réordonner.
 */
function Tri({
  items, sensors, onOrdre, children,
}: {
  items: { id: string }[]
  sensors: ReturnType<typeof useSensors>
  onOrdre: (actif: string, sur: string) => void
  children: React.ReactNode
}) {
  const fin = (e: DragEndEvent) => {
    const { active, over } = e
    if (over && active.id !== over.id) onOrdre(String(active.id), String(over.id))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={fin}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

/**
 * Le parent d'un ajout porte sa NATURE autant que son nom : « Dans Lecture »
 * ne dit pas ce qu'est Lecture, et un cours peut pendre à un module comme
 * directement à une unité.
 */
type Parent = { nature: 'ue' | 'module'; nom: string }
type Nature = 'ue' | 'module' | 'cours'

/** Saisie en cours : création (`item` absent) ou modification. */
type Saisie = {
  nature: Nature
  parent: Parent | null
  item?: { id: string; code: string | null; nom_fr: string; nom_ar: string | null }
}

/**
 * Formulaire d'ajout, en modale VERROUILLÉE.
 *
 * `FormModal` est la coque de saisie du projet : ni clic sur le fond, ni Échap.
 * Une modale qui contient des champs ne doit pas pouvoir se fermer par accident
 * — un clic à côté effacerait la saisie sans un mot. Seuls X et Annuler ferment.
 * (Échap reste accepté sur les CONFIRMATIONS, qui n'ont rien à perdre.)
 *
 * Les trois natures partagent Réf / Nom (FR) / Nom (AR) ; seule l'unité ajoute
 * sa couleur. Le sous-titre rappelle À QUOI on rattache : dans une maquette à
 * trois colonnes, la destination d'un ajout doit être écrite, pas déduite de la
 * colonne d'où l'on a cliqué.
 */
function ModaleSaisie({
  saisie, onClose, onValider,
}: {
  saisie: Saisie
  onClose: () => void
  onValider: (v: { code: string; nomFr: string; nomAr: string }) => Promise<string | null>
}) {
  const [ref, setRef]     = useState(saisie.item?.code ?? '')
  const [nomFr, setNomFr] = useState(saisie.item?.nom_fr ?? '')
  const [nomAr, setNomAr] = useState(saisie.item?.nom_ar ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const edition = !!saisie.item
  const NOM: Record<Nature, string> = { ue: "unité d'enseignement", module: 'module', cours: 'cours' }
  const titre = edition
    ? `Modifier ${saisie.nature === 'ue' ? "l'unité d'enseignement" : saisie.nature === 'module' ? 'le module' : 'le cours'}`
    : saisie.nature === 'ue' ? "Nouvelle unité d'enseignement" : `Nouveau ${NOM[saisie.nature]}`

  const rattachement = !saisie.parent ? null
    : saisie.parent.nature === 'module'
      ? `Dans le module « ${saisie.parent.nom} »`
      : `Dans l'UE « ${saisie.parent.nom} »`

  const valider = async () => {
    setEnvoi(true); setErreur(null)
    const err = await onValider({ code: ref.trim(), nomFr: nomFr.trim(), nomAr: nomAr.trim() })
    if (err) { setErreur(err); setEnvoi(false); return }
    onClose()
  }

  return (
    <FormModal
      title={titre}
      onClose={onClose}
      footerSeparator={false}
      footer={
        /* Le pied porte la RÉF et les boutons sur la même ligne — réf à gauche,
           actions à droite — et la mention des champs obligatoires sous la réf.
           Même disposition sur les trois natures : une modale d'ajout ne doit
           pas se relire différemment selon ce qu'on ajoute.
           `w-full` : le pied de `FormModal` est un `flex items-center`, un
           enfant unique pleine largeur y reprend la main sur la mise en page. */
        <div className="w-full">
          <div className="flex items-end gap-3">
            <div className="w-24 flex-shrink-0">
              <FloatInput
                label="Réf" value={ref} required
                onChange={e => setRef(e.target.value.toUpperCase())}
              />
            </div>
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              <FloatButton type="button" variant="secondary" onClick={onClose} disabled={envoi}>
                Annuler
              </FloatButton>
              <FloatButton
                type="button"
                variant={edition ? 'edit' : 'submit'}
                onClick={valider}
                disabled={envoi || !ref.trim() || !nomFr.trim()}
              >
                {envoi ? 'Enregistrement…' : 'Valider'}
              </FloatButton>
            </div>
          </div>
          <p className="text-[11px] text-[var(--ink-muted)] mt-1">* champs obligatoires</p>
        </div>
      }
    >
      {rattachement && (
        <p className="text-xs text-[var(--ink-muted)] -mt-1">{rattachement}</p>
      )}
      {erreur && (
        <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erreur}</p>
      )}

      <FloatInput
        label="Nom (FR)" value={nomFr} required
        onChange={e => setNomFr(e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1))}
      />

      <FloatInput
        label="Nom (AR)" value={nomAr} dir="rtl" style={arStyle}
        onChange={e => setNomAr(e.target.value)}
      />
    </FormModal>
  )
}

function Vide({ texte }: { texte: string }) {
  return <p className="px-3 py-6 text-xs text-[var(--ink-muted)] text-center">{texte}</p>
}

/**
 * Groupe de cours d'un module, présenté en CARTE avec son en-tête.
 *
 * Le rattachement est porté par la STRUCTURE et non par la couleur. La piste
 * des bandes teintées a été abandonnée après mesure : au-delà de cinq teintes,
 * garder toutes les paires distinctes pour toutes les formes de daltonisme est
 * impossible dans cet espace — la palette de 15 couleurs du projet échoue
 * d'ailleurs au contrôle (violet contre bleu, ΔE 1,3). Une bordure et un
 * en-tête ne connaissent pas ce plafond, et se lisent en noir et blanc.
 */
function CarteGroupe({
  titre, compte, children,
}: {
  titre: string; compte: number; children: React.ReactNode
}) {
  return (
    <div role="group" aria-label={titre} className="rounded-lg border border-[var(--line-strong)] overflow-hidden">
      <div className="h-7 flex items-center gap-2 px-2.5 bg-[var(--surface-sunken)] border-b border-[var(--line)]">
        <span aria-hidden="true" className="list-th !px-0 !py-0 truncate">{titre}</span>
        <span className="text-[10px] text-[var(--ink-muted)] tabular-nums ml-auto flex-shrink-0 whitespace-nowrap">
          {compte} cours
        </span>
      </div>
      <div className="py-0.5">{children}</div>
    </div>
  )
}

/**
 * Réordonne un SOUS-ENSEMBLE à l'intérieur du tableau complet.
 *
 * Les modules d'une unité, ou les cours d'un module, ne sont pas contigus dans
 * le tableau global : on déplace donc l'élément dans le sous-ensemble, puis on
 * réécrit les positions que ce sous-ensemble occupait. Sans ça, un `arrayMove`
 * sur le tableau entier ferait traverser les autres unités à l'élément.
 */
function reordonner<T extends { id: string }>(tout: T[], sous: T[], actif: string, sur: string): T[] {
  const ids = sous.map(x => x.id)
  const de = ids.indexOf(actif)
  const vers = ids.indexOf(sur)
  if (de < 0 || vers < 0 || de === vers) return tout

  const nouvelOrdre = arrayMove(ids, de, vers)
  const positions = tout.reduce<number[]>((acc, x, i) => (ids.includes(x.id) ? [...acc, i] : acc), [])
  const copie = [...tout]
  positions.forEach((pos, k) => { copie[pos] = tout.find(x => x.id === nouvelOrdre[k])! })
  return copie
}

export default function ReferentielColonnes({
  ues, modules, cours, gabaritsParCours, anneeLabel, etablissementId,
}: {
  ues: UniteEnseignement[]
  modules: CoursModule[]
  cours: Cours[]
  /** Exigé à la création d'une unité : elle seule porte le cloisonnement, les
   *  modules et les cours l'héritent par leur unité. */
  etablissementId: string
  gabaritsParCours: Record<string, number>
  anneeLabel: string | null
}) {
  const [sel, setSel] = useState<Selection>({ ueId: null, moduleId: null, coursId: null })
  const [search, setSearch] = useState('')
  const [saisie, setSaisie] = useState<Saisie | null>(null)
  const [aSupprimer, setASupprimer] = useState<{ nature: Nature; id: string; nom: string } | null>(null)
  const router = useRouter()

  const TABLE: Record<Nature, string> = {
    ue: 'unites_enseignement', module: 'cours_modules', cours: 'cours',
  }

  /**
   * Écriture d'une création ou d'une modification.
   *
   * Le `.select()` n'est pas décoratif : une écriture refusée par la RLS ne
   * lève AUCUNE erreur, elle touche simplement zéro ligne. Sans lui, l'écran
   * annoncerait un succès puis se rafraîchirait sur des données inchangées.
   */
  const enregistrer = async (v: { code: string; nomFr: string; nomAr: string }): Promise<string | null> => {
    if (!saisie) return 'Rien à enregistrer.'
    const supabase = createClient()
    const champs = { code: v.code || null, nom_fr: v.nomFr, nom_ar: v.nomAr || null }

    // Un ajout se range TOUJOURS EN DERNIER : on prend le rang le plus haut de
    // ses futurs voisins, plus un. S'en remettre au `NULLS LAST` de Postgres
    // marcherait par accident aujourd'hui, mais un rang explicite survit au
    // premier réordonnancement, qui renumérote tout le monde.
    //
    // Les COURS n'ont pas de rang : ils s'affichent par ordre alphabétique.
    const rangSuivant = (fratrie: { order_index: number | null }[]) =>
      fratrie.reduce((max, x) => Math.max(max, (x.order_index ?? -1) + 1), 0)

    const req = saisie.item
      ? supabase.from(TABLE[saisie.nature]).update(champs).eq('id', saisie.item.id).select('id')
      : supabase.from(TABLE[saisie.nature]).insert({
          ...champs,
          ...(saisie.nature === 'ue'
            ? { etablissement_id: etablissementId, order_index: rangSuivant(lstUes) }
            : saisie.nature === 'module'
              ? {
                  unite_enseignement_id: sel.ueId,
                  order_index: rangSuivant(lstModules.filter(m => m.unite_enseignement_id === sel.ueId)),
                }
              : { unite_enseignement_id: sel.ueId, module_id: saisie.parent?.nature === 'module' ? sel.moduleId : null }),
        }).select('id')

    const { data, error } = await req
    if (error) return error.message
    if (!data || data.length === 0) return "Écriture refusée : vous n'avez pas les droits sur le référentiel."
    router.refresh()
    return null
  }

  /**
   * Ordre persisté. On réécrit `order_index` sur TOUT le sous-ensemble et non
   * sur les deux éléments échangés : les index d'origine peuvent être nuls ou
   * en doublon (rien ne les contraint), et une renumérotation complète est la
   * seule qui produise un ordre sans ambiguïté.
   */
  const persisterOrdre = async (nature: Nature, liste: { id: string }[]) => {
    const supabase = createClient()
    await Promise.all(liste.map((x, i) =>
      supabase.from(TABLE[nature]).update({ order_index: i }).eq('id', x.id),
    ))
  }



  // L'ordre affiché est local pour que le glisser-déposer réponde tout de
  // suite ; `persisterOrdre` écrit `order_index` dans la foulée.
  const [lstUes, setLstUes]         = useState(ues)
  const [lstModules, setLstModules] = useState(modules)
  const [lstCours, setLstCours]     = useState(cours)
  useEffect(() => { setLstUes(ues) },         [ues])
  useEffect(() => { setLstModules(modules) }, [modules])
  useEffect(() => { setLstCours(cours) },     [cours])

  // `PointerSensor` avec une distance d'activation : sans elle, un simple clic
  // de sélection serait interprété comme le début d'un déplacement.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const q = norm(search)
  const matche = (...champs: (string | null | undefined)[]) =>
    !q || champs.some(c => norm(c).includes(q))

  /**
   * Les COURS s'affichent par ordre ALPHABÉTIQUE, et ne se réordonnent pas —
   * décision de l'utilisateur, revenant sur le tri manuel. `localeCompare` en
   * français, sans quoi « Écriture » se rangerait après « Zoologie » : un tri
   * brut compare des points de code, où les lettres accentuées suivent tout
   * l'alphabet latin.
   */
  const alpha = (liste: Cours[]) =>
    [...liste].sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, 'fr', { sensitivity: 'base' }))

  // Somme des gabarits d'un ensemble de cours — sert aux trois niveaux.
  const somme = (liste: Cours[]) => liste.reduce((t, c) => t + (gabaritsParCours[c.id] ?? 0), 0)

  // La recherche ne filtre pas les trois colonnes indépendamment : elle garde
  // une unité si elle-même OU l'un de ses descendants correspond. Sinon on
  // cherche un cours et l'unité qui le porte disparaît, ce qui le rend
  // inatteignable.
  const uesFiltrees = useMemo(() => {
    if (!q) return lstUes
    return lstUes.filter(ue => {
      const sesModules = lstModules.filter(m => m.unite_enseignement_id === ue.id)
      const sesCours   = lstCours.filter(c => c.unite_enseignement_id === ue.id)
      return matche(ue.nom_fr, ue.nom_ar, ue.code)
        || sesModules.some(m => matche(m.nom_fr, m.nom_ar, m.code))
        || sesCours.some(c => matche(c.nom_fr, c.nom_ar, c.code))
    })
  }, [lstUes, lstModules, lstCours, q]) // eslint-disable-line react-hooks/exhaustive-deps

  // La recherche PORTE la sélection sur le premier résultat : sans ça, on
  // filtre une colonne dont l'unité sélectionnée a disparu, et les deux autres
  // restent obstinément vides. On ne touche à rien si la sélection courante
  // fait toujours partie des résultats.
  useEffect(() => {
    if (!q) return
    setSel(courant => {
      const encoreLa = uesFiltrees.some(u => u.id === courant.ueId)
      if (encoreLa) return courant
      const premiere = uesFiltrees[0]
      return premiere ? { ueId: premiere.id, moduleId: null, coursId: null } : courant
    })
  }, [q, uesFiltrees])


  const ueActive = sel.ueId

  // La recherche traverse les TROIS colonnes. Ne filtrer que les unités — ce
  // qu'elle faisait — reste invisible tant qu'il n'y en a qu'une : la seule
  // colonne qui réagissait était celle qui ne pouvait rien montrer.
  //
  // Un module est gardé s'il correspond LUI-MÊME ou si l'un de ses cours
  // correspond ; sinon chercher un cours ferait disparaître le module qui le
  // porte, et le cours deviendrait inatteignable.
  const modulesDeUE = lstModules
    .filter(m => m.unite_enseignement_id === ueActive)
    .filter(m => !q || matche(m.nom_fr, m.nom_ar, m.code)
      || lstCours.some(c => c.module_id === m.id && matche(c.nom_fr, c.nom_ar, c.code)))

  const coursDirects = lstCours
    .filter(c => c.unite_enseignement_id === ueActive && !c.module_id)
    .filter(c => !q || matche(c.nom_fr, c.nom_ar, c.code))

  const SANS_MODULE = '__directs__'

  // La destination d'un ajout doit être ÉCRITE dans la modale, pas déduite de
  // la colonne d'où l'on a cliqué.
  const nomUE = lstUes.find(u => u.id === ueActive)?.nom_fr ?? ''
  const nomModule = lstModules.find(m => m.id === sel.moduleId)?.nom_fr ?? ''

  /**
   * Ce que montre la troisième colonne : une CARTE par module.
   *
   * Aucun module choisi → toute l'unité, module par module. Un module choisi →
   * cette seule carte. La présentation ne change pas d'un cas à l'autre : le
   * regard n'a rien à réapprendre, seule la quantité varie.
   *
   * Les modules VIDES sont écartés : une carte à en-tête sans contenu
   * n'apprendrait rien et allongerait la colonne. Leur existence se lit dans la
   * colonne du milieu, qui est faite pour ça.
   */
  const groupes = useMemo(() => {
    const tous = [
      ...modulesDeUE.map(m => ({
        cle: m.id,
        titre: m.nom_fr,
        // Un module retenu parce qu'il correspond LUI-MÊME montre tous ses
        // cours ; retenu pour l'un de ses cours, il ne montre que ceux-là.
        liste: alpha(lstCours.filter(c => c.module_id === m.id
          && (!q || matche(m.nom_fr, m.nom_ar, m.code) || matche(c.nom_fr, c.nom_ar, c.code)))),
      })),
      { cle: SANS_MODULE, titre: 'Sans module', liste: alpha(coursDirects) },
    ].filter(g => g.liste.length > 0)

    return sel.moduleId ? tous.filter(g => g.cle === sel.moduleId) : tous
  }, [modulesDeUE, coursDirects, lstCours, sel.moduleId, q]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Suppression ───────────────────────────────────────────────────────────
  //
  // La barrière vit en BASE (`guard-referentiel-delete.sql`) : les clés sont en
  // RESTRICT et un déclencheur refuse un cours qui sert un gabarit de l'année
  // en cours. Ce qui suit ne fait qu'ANNONCER ce que la base appliquera — un
  // écran ne protège rien, la suppression partant du navigateur.
  const [deps, setDeps] = useState<DeleteDeps>({ etat: 'calcul' })
  const [erreurSuppr, setErreurSuppr] = useState<string | null>(null)

  useEffect(() => {
    if (!aSupprimer) return
    let annule = false
    setDeps({ etat: 'calcul' }); setErreurSuppr(null)
    const pret = (motifBlocage: string | null, avertissements: string[] = [], emplacements: Emplacement[] = []) => {
      if (!annule) setDeps({ etat: 'pret', motifBlocage, avertissements, emplacements })
    }

    if (aSupprimer.nature === 'module') {
      const n = lstCours.filter(c => c.module_id === aSupprimer.id).length
      pret(n > 0 ? `Ce module contient encore ${n} cours. Supprimez-les d'abord.` : null)
      return
    }
    if (aSupprimer.nature === 'ue') {
      const nMod = lstModules.filter(m => m.unite_enseignement_id === aSupprimer.id).length
      const nCrs = lstCours.filter(c => c.unite_enseignement_id === aSupprimer.id).length
      const restes = [
        nMod > 0 ? `${nMod} module${nMod > 1 ? 's' : ''}` : null,
        nCrs > 0 ? `${nCrs} cours` : null,
      ].filter(Boolean).join(' et ')
      pret(restes ? `Cette unité contient encore ${restes}. Videz-la d'abord.` : null)
      return
    }

    // Un cours : ses gabarits vivent ailleurs, il faut aller les compter.
    ;(async () => {
      const supabase = createClient()
      // Classe et période remontées avec le compte : `!inner` sur `classes`
      // (le filtre d'année en dépend), simple sur `periods` — une évaluation
      // sans période existe en base, la masquer fausserait le compte.
      const { data } = await supabase
        .from('evaluations')
        .select('id, classes!inner(academic_year, name), periods(label)')
        .eq('cours_id', aSupprimer.id)

      type Ligne = {
        classes: { academic_year: string; name: string } | { academic_year: string; name: string }[]
        periods: { label: string } | { label: string }[] | null
      }
      // PostgREST rend un objet ou un tableau selon la cardinalité qu'il déduit :
      // on aplatit dans les deux cas plutôt que de parier sur l'une des formes.
      const un = <T,>(v: T | T[] | null): T | undefined => (Array.isArray(v) ? v[0] : v ?? undefined)

      const lignes = (data ?? []) as Ligne[]
      const vivantes = anneeLabel
        ? lignes.filter(l => un(l.classes)?.academic_year === anneeLabel)
        : []
      const archives = lignes.length - vivantes.length

      const emplacements: Emplacement[] = vivantes
        .map(l => ({
          classe:  un(l.classes)?.name ?? '(classe inconnue)',
          periode: un(l.periods)?.label ?? '(sans période)',
        }))
        .sort((a, b) => a.classe.localeCompare(b.classe, 'fr') || a.periode.localeCompare(b.periode, 'fr'))

      pret(
        vivantes.length > 0
          ? `Ce cours est encore présent dans ${vivantes.length} gabarit${vivantes.length > 1 ? 's' : ''} d'évaluation de l'année en cours.`
          : null,
        archives > 0
          ? [`${archives} évaluation${archives > 1 ? 's' : ''} d'années précédentes archivées perdront leur rattachement.`]
          : [],
        emplacements,
      )
    })()
    return () => { annule = true }
  }, [aSupprimer, lstCours, lstModules, anneeLabel])

  const supprimer = async () => {
    if (!aSupprimer) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from(TABLE[aSupprimer.nature]).delete().eq('id', aSupprimer.id).select('id')

    if (error) { setErreurSuppr(error.message || 'La suppression a échoué.'); return }
    if (!data || data.length === 0) {
      setErreurSuppr("Suppression refusée : vous n'avez pas les droits sur le référentiel.")
      return
    }
    // La sélection pointait peut-être sur ce qui vient de disparaître.
    setSel(s => ({
      ueId:     aSupprimer.nature === 'ue' ? null : s.ueId,
      moduleId: aSupprimer.nature === 'cours' ? s.moduleId : null,
      coursId:  null,
    }))
    setASupprimer(null)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <div className="card px-3 py-2 flex items-center gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          // Le champ est plus étroit que l'énumération complète, qui se coupait
          // en plein mot. Le cours vient en tête : c'est ce qu'on cherche le
          // plus souvent, et l'`aria-label` porte la portée réelle.
          placeholder="Rechercher un cours, un module…"
          ariaLabel="Rechercher une unité, un module ou un cours"
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
            actions={[{ libelle: 'Ajouter', aria: 'Ajouter une unité', onClick: () => setSaisie({ nature: 'ue', parent: null }) }]}
            liste="Unités d'enseignement"
            className="w-fit min-w-[13rem] max-w-[24rem]"
          >
            {uesFiltrees.length === 0
              ? <Vide texte={q ? 'Aucun résultat.' : 'Aucune unité.'} />
              : <Tri items={uesFiltrees} sensors={sensors} onOrdre={(a, b) => setLstUes(t => {
                  const n = reordonner(t, uesFiltrees, a, b)
                  void persisterOrdre('ue', n.filter(u => uesFiltrees.some(f => f.id === u.id)))
                  return n
                })}>
                {uesFiltrees.map(ue => (
                  <Ligne
                    key={ue.id} id={ue.id} q={q}
                    code={ue.code} nomFr={ue.nom_fr} nomAr={ue.nom_ar}
                    badge={<Badge n={somme(lstCours.filter(c => c.unite_enseignement_id === ue.id))} annee={anneeLabel} />}
                    actif={sel.ueId === ue.id}
                    chevron
                    onSelect={() => setSel({ ueId: ue.id, moduleId: null, coursId: null })}
                    onEditer={() => setSaisie({ nature: 'ue', parent: null, item: ue })}
                    onSupprimer={() => setASupprimer({ nature: 'ue', id: ue.id, nom: ue.nom_fr })}
                  />
                ))}
              </Tri>}
          </Encadre>
        </div>

        {/* ── Encadré 2 : modules, puis cours sans module ───────────────────── */}
        <div className="flex">
          <Encadre
            titre="Modules"
            compte={modulesDeUE.length + (coursDirects.length ? 1 : 0)}
            actions={ueActive ? [
              { libelle: 'Module', aria: 'Ajouter un module à cette unité',
                onClick: () => setSaisie({ nature: 'module', parent: { nature: 'ue', nom: nomUE } }) },
              { libelle: 'Cours',  aria: 'Ajouter un cours directement à cette unité',
                onClick: () => setSaisie({ nature: 'cours', parent: { nature: 'ue', nom: nomUE } }) },
            ] : []}
            liste="Modules de l'unité"
            className="w-fit min-w-[14rem] max-w-[26rem]"
          >
            {!ueActive ? (
              <Vide texte="Sélectionnez une unité." />
            ) : (
              <>
                <Tri items={modulesDeUE} sensors={sensors} onOrdre={(a, b) => setLstModules(t => {
                  const n = reordonner(t, modulesDeUE, a, b)
                  void persisterOrdre('module', n.filter(m => m.unite_enseignement_id === ueActive))
                  return n
                })}>
                {modulesDeUE.map(m => (
                  <Ligne
                    key={m.id} id={m.id} q={q}
                    code={m.code} nomFr={m.nom_fr} nomAr={m.nom_ar}
                    badge={<Badge n={somme(lstCours.filter(c => c.module_id === m.id))} annee={anneeLabel} />}
                    actif={sel.moduleId === m.id}
                    chevron
                    onSelect={() => setSel(s => ({ ...s, moduleId: m.id, coursId: null }))}
                    onEditer={() => setSaisie({ nature: 'module', parent: { nature: 'ue', nom: nomUE }, item: m })}
                    onSupprimer={() => setASupprimer({ nature: 'module', id: m.id, nom: m.nom_fr })}
                  />
                ))}
                </Tri>

                {/* Les cours SANS module. Groupés et nommés plutôt que mêlés
                    aux modules : sans ça, la colonne mélangerait deux natures
                    et la troisième deviendrait imprévisible. */}
                {coursDirects.length > 0 && (
                  <div role="group" aria-label="Cours sans module">
                    <p aria-hidden="true" className="list-th !py-1 mt-1 border-t border-[var(--line)] pt-2">
                      Cours sans module
                    </p>
                    <Ligne
                      id={SANS_MODULE}
                      triable={false}
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
            compte={groupes.reduce((t, g) => t + g.liste.length, 0)}
            actions={sel.moduleId ? [{
              libelle: 'Ajouter', aria: 'Ajouter un cours',
              // Le groupe « sans module » rattache à l'UNITÉ, pas à un module.
              onClick: () => setSaisie({
                nature: 'cours',
                parent: sel.moduleId === SANS_MODULE
                  ? { nature: 'ue', nom: nomUE }
                  : { nature: 'module', nom: nomModule },
              }),
            }] : []}
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
            ) : groupes.length === 0 ? (
              <Vide texte={sel.moduleId ? 'Ce module ne contient aucun cours.' : "Cette unité ne contient aucun cours."} />
            ) : (
              /* Une carte par module. Choisir un module dans la colonne du
                 milieu ne change pas la presentation : il ne reste qu'une
                 carte. Le regard n'a donc rien a reapprendre. */
              <div className="px-2 py-1.5 space-y-1.5">
                {groupes.map(g => (
                  <CarteGroupe key={g.cle} titre={g.titre} compte={g.liste.length}>
                    {g.liste.map(c => (
                      <Ligne
                        key={c.id} id={c.id} q={q} triable={false}
                        code={c.code} nomFr={c.nom_fr} nomAr={c.nom_ar}
                        badge={<Badge n={gabaritsParCours[c.id] ?? 0} annee={anneeLabel} />}
                        actif={sel.coursId === c.id}
                        chevron={false}
                        onSelect={() => setSel(s => ({ ...s, coursId: c.id }))}
                        onEditer={() => setSaisie({
                          nature: 'cours',
                          parent: c.module_id
                            ? { nature: 'module', nom: g.titre }
                            : { nature: 'ue', nom: nomUE },
                          item: c,
                        })}
                        onSupprimer={() => setASupprimer({ nature: 'cours', id: c.id, nom: c.nom_fr })}
                      />
                    ))}
                  </CarteGroupe>
                ))}
              </div>
            )}
          </Encadre>
        </div>

      </div>

      {saisie && (
        <ModaleSaisie saisie={saisie} onClose={() => setSaisie(null)} onValider={enregistrer} />
      )}

      {aSupprimer && (
        <ConfirmModal
          variant="danger"
          confirmLabel="Supprimer"
          confirmDisabled={deps.etat !== 'pret' || !!deps.motifBlocage}
          onCancel={() => setASupprimer(null)}
          onConfirm={supprimer}
        >
          <div className="space-y-2">
            <p className="text-sm text-warm-700">
              Supprimer <strong className="text-secondary-700">« {aSupprimer.nom} »</strong> ?
            </p>
            {deps.etat === 'calcul' && (
              <p className="text-xs text-warm-700">Vérification des dépendances…</p>
            )}
            {deps.etat === 'pret' && deps.motifBlocage && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{deps.motifBlocage}</p>
            )}
            {deps.etat === 'pret' && deps.emplacements.length > 0 && (
              /* Hauteur bornée : un cours peut servir dans beaucoup de classes,
                 et une modale qui s'allonge repousse ses boutons hors de l'écran. */
              <div className="rounded-lg border border-[var(--line-strong)] overflow-hidden max-h-40 overflow-y-auto list-scroll">
                <table className="w-full text-xs" aria-label="Gabarits qui utilisent ce cours">
                  <thead>
                    <tr className="bg-[var(--surface-sunken)]">
                      <th scope="col" className="list-th !px-2 !py-1">Classe</th>
                      <th scope="col" className="list-th !px-2 !py-1">Période</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deps.emplacements.map((e: Emplacement, i: number) => (
                      <tr key={`${e.classe}-${e.periode}-${i}`} className="border-t border-[var(--line)]">
                        <td className="px-2 py-1 text-[var(--ink)]">{e.classe}</td>
                        <td className="px-2 py-1 text-[var(--ink-muted)]">{e.periode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {deps.etat === 'pret' && !deps.motifBlocage && deps.avertissements.map((a: string) => (
              <p key={a} className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{a}</p>
            ))}
            {erreurSuppr && (
              <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erreurSuppr}</p>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  )
}
