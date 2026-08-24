'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, X } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { COLONNES } from '@/lib/import/colonnes'
import { lireFichierXlsx, type LigneBrute } from '@/lib/import/lire-fichier'
import { rapprocher, type FoyerExistant, type EnfantExistant, type FoyerRapproche } from '@/lib/import/rapprocher'
import { enregistrerFoyers, type FoyerAEnregistrer, type ResultatFoyer } from '@/app/dashboard/import/actions'

/**
 * ECRAN D'IMPORTATION DE FAMILLES.
 *
 * ┌─ LE DEROULE ─────────────────────────────────────────────────────────────┐
 * │ 1. On depose un fichier. Il est lu DANS LE NAVIGATEUR et reformate aux    │
 * │    regles de la saisie manuelle. Rien n'est ecrit, rien n'est televerse.  │
 * │ 2. Chaque foyer reçoit une ACTION, pas un verdict : creer, completer,     │
 * │    mettre a jour, rien a faire, ou bloque.                                │
 * │ 3. On coche ce qui est bon, on enregistre. Les foyers ecrits DISPARAISSENT│
 * │    du tableau.                                                            │
 * │ 4. Il reste les bloques. On corrige EN PLACE, la ligne est revalidee, et  │
 * │    elle redevient cochable. D'ou les passes successives.                  │
 * └───────────────────────────────────────────────────────────────────────────┘
 */

interface Props {
  foyers: FoyerExistant[]
  enfants: EnfantExistant[]
}

// ─── Couleurs par ACTION, jamais par verdict ─────────────────────────────────
//
// Le rouge ne signale plus « existe deja » — en aout, c'est le cas NORMAL. Il
// est reserve a ce qui demande une decision. Et le motif reste ecrit EN CLAIR
// sur la ligne : une couleur seule ne dit pas quoi corriger, et elle est
// invisible pour un daltonien.
const STYLE_ACTION: Record<string, { fond: string; pastille: string; libelle: string }> = {
  creer:         { fond: 'bg-primary-50', pastille: 'bg-primary-100 text-primary-800', libelle: 'Créer la famille' },
  completer:     { fond: 'bg-primary-50', pastille: 'bg-primary-100 text-primary-800', libelle: 'Ajouter au foyer existant' },
  mettre_a_jour: { fond: 'bg-amber-50',   pastille: 'bg-amber-100 text-amber-800',     libelle: 'Mettre à jour le foyer' },
  rien:          { fond: 'bg-warm-50',    pastille: 'bg-warm-200 text-warm-800',       libelle: 'Déjà enregistré' },
  bloque:        { fond: 'bg-red-50',     pastille: 'bg-red-100 text-red-800',         libelle: 'Bloqué' },
}

/**
 * Statut d'un APPRENANT, dans les memes couleurs que celui du foyer.
 *
 * Ils etaient en gris, tous les trois : il fallait LIRE chaque ligne pour savoir
 * ce qui allait etre cree. En pastille coloree, l'oeil balaie la colonne et voit
 * d'un coup ce que l'enregistrement va faire — c'est tout l'interet d'un tableau
 * de relecture.
 *
 * Le libelle reste ECRIT : la couleur seule ne dit rien a qui la distingue mal,
 * et « à créer » n'a pas de couleur evidente.
 */
const STYLE_ENFANT: Record<string, { pastille: string; libelle: string }> = {
  creer:  { pastille: 'bg-primary-100 text-primary-800', libelle: 'à créer' },
  rien:   { pastille: 'bg-warm-200 text-warm-800',       libelle: 'déjà enregistré' },
  bloque: { pastille: 'bg-red-100 text-red-800',         libelle: 'bloqué' },
}

/** Pastille de statut : meme forme pour le foyer et pour l'apprenant. */
function Pastille({ style, children }: { style: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${style}`}>
      {children}
    </span>
  )
}

const STYLE_GRAVITE: Record<string, string> = {
  bloquant:      'text-red-700',
  invalide:      'text-orange-700',
  avertissement: 'text-amber-700',
}

/** Colonnes montrees en clair sur la ligne enfant. */
const COLS_ENFANT = ['last_name', 'first_name', 'date_of_birth', 'gender']

/**
 * Les noms des tuteurs : la CLE DE RAPPROCHEMENT d'un foyer.
 *
 * `import_foyer()` ne les met jamais a jour — un import ne renomme personne.
 * Sur un foyer DEJA ENREGISTRE, les laisser modifiables faisait donc croire a
 * une correction possible alors qu'elle n'aurait rien fait ; pire, changer le
 * nom du tuteur 1 aurait silencieusement designe un AUTRE foyer, ou fabrique
 * une famille de plus.
 *
 * Consequence assumee : un foyer existant ne peut pas gagner un second tuteur
 * par import. Cela se fait sur la fiche parents, ou l'operation est explicite.
 */
const CLES_IDENTITE_FOYER = [
  'tutor1_last_name', 'tutor1_first_name',
  'tutor2_last_name', 'tutor2_first_name',
]

const libelleColonne = (cle: string) => COLONNES.find(c => c.cle === cle)?.entete ?? cle

/**
 * Ce que le champ MONTRE.
 *
 * La base garde « 2015-07-14 » et « male » ; l'ecran doit afficher
 * « 14/07/2015 » et « Masculin ». La mise en forme vit dans le catalogue, pas
 * ici — c'est lui qui sait ce que chaque colonne stocke.
 *
 * Le TEXTE REFUSE, lui, n'est jamais reformate : c'est ce que l'utilisateur a
 * ecrit, on le lui rend intact pour qu'il le corrige.
 */
function valeurAffichee(
  cle: string,
  valeurs: Record<string, string | null>,
  bruts: Record<string, string>,
): string | null {
  const v = valeurs[cle]
  if (v === null || v === undefined) return bruts[cle] ?? null
  const col = COLONNES.find(c => c.cle === cle)
  return col?.afficher ? col.afficher(v) : v
}

export default function ImportClient({ foyers, enfants }: Props) {
  const router = useRouter()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [lignes, setLignes] = useState<LigneBrute[] | null>(null)
  const [nomFichier, setNomFichier] = useState('')
  const [avertissementsFichier, setAvertissementsFichier] = useState<string[]>([])
  const [cochees, setCochees] = useState<Set<string>>(new Set())
  const [deplie, setDeplie] = useState<Set<string>>(new Set())
  const [enCours, setEnCours] = useState(false)
  const [confirmer, setConfirmer] = useState(false)
  const [compteRendu, setCompteRendu] = useState<ResultatFoyer[] | null>(null)

  // Le rapprochement est RECALCULE a chaque modification de cellule : c'est ce
  // qui fait qu'une ligne corrigee redevient cochable sans rien relancer.
  const resultat = useMemo(
    () => (lignes ? rapprocher(lignes, foyers, enfants) : []),
    [lignes, foyers, enfants],
  )

  const aFaire = resultat.filter(f => f.enregistrable)

  // Un foyer devenu bloque quitte la selection : sans cela le compteur
  // annoncerait « 12 coches » alors que 11 seulement partiraient.
  const cochesValides = useMemo(
    () => new Set([...cochees].filter(c => aFaire.some(f => f.cle === c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cochees, resultat],
  )

  // Etat partiel de la case d'en-tete : une partie seulement est cochee.
  const partiel = cochesValides.size > 0 && cochesValides.size < aFaire.length

  // ── Depot du fichier ──────────────────────────────────────────────────────
  const charger = useCallback(async (fichier: File) => {
    setCompteRendu(null)
    try {
      const lecture = await lireFichierXlsx(fichier)

      if (lecture.colonnesManquantes.length > 0) {
        toast.error('Colonnes obligatoires absentes : ' + lecture.colonnesManquantes.join(', '))
        return
      }
      if (lecture.lignes.length === 0) {
        toast.warning('Ce fichier ne contient aucune ligne à importer.')
        return
      }

      const avert: string[] = []
      if (lecture.entetesInconnues.length > 0) {
        avert.push('Colonnes ignorées : ' + lecture.entetesInconnues.join(', '))
      }

      setNomFichier(fichier.name)
      setAvertissementsFichier(avert)
      setLignes(lecture.lignes)
      setCochees(new Set())
    } catch {
      // Un fichier illisible, c'est presque toujours un .xls ancien ou un .csv
      // renomme : le dire, plutot qu'un « une erreur est survenue » qui laisse
      // l'utilisateur sans piste.
      toast.error("Fichier illisible. Attendu : un classeur .xlsx, tel que le gabarit.")
    }
  }, [toast])

  // ── Correction en place ───────────────────────────────────────────────────
  const modifier = (numeroLigne: number, cle: string, saisi: string) => {
    setLignes(prev => {
      if (!prev) return prev
      const col = COLONNES.find(c => c.cle === cle)
      if (!col) return prev

      return prev.map(l => {
        if (l.numero !== numeroLigne) return l

        const { valeur, erreur, brut } = col.normaliser(saisi)

        const valeurs = { ...l.valeurs, [cle]: valeur }
        const bruts = { ...l.bruts }
        if (brut !== undefined) bruts[cle] = brut
        else delete bruts[cle]

        // Seule l'erreur de CETTE cellule est recalculee. Rejouer toute la
        // ligne serait inutile — les autres valeurs n'ont pas bouge — et
        // fragile : il a suffi d'une normalisation non idempotente pour que
        // corriger un nom invalide la colonne Genre.
        const erreurs = l.erreurs.filter(e => e.cle !== cle)
        if (erreur) erreurs.push({ cle, message: erreur })
        else if (col.obligatoire && !valeur) {
          erreurs.push({ cle, message: `« ${col.entete} » est obligatoire` })
        }

        return { ...l, valeurs, bruts, erreurs }
      })
    })
  }

  // ── Enregistrement ────────────────────────────────────────────────────────
  const enregistrer = async () => {
    setConfirmer(false)
    setEnCours(true)

    // `enregistrable` EN PLUS de `cochees` : la case est grisee quand le foyer
    // est bloque, mais cocher est un INSTANT et l'etat change ensuite. On coche
    // pendant que c'est valide, on vide l'email dans le panneau des
    // coordonnees, et la case reste cochee. C'est exactement ainsi qu'un foyer
    // a ete cree sans email le 24 aout.
    const lots: FoyerAEnregistrer[] = resultat
      .filter(f => cochees.has(f.cle) && f.enregistrable)
      .map(f => ({
        cle: f.cle,
        libelle: `${f.valeurs.tutor1_last_name ?? ''} ${f.valeurs.tutor1_first_name ?? ''}`.trim(),
        foyerId: f.existantId ?? null,
        // A la mise a jour on n'envoie QUE ce qui change : la fonction laisse en
        // place toute cle absente, donc rien d'autre ne peut etre touche.
        foyer: f.existantId
          ? Object.fromEntries(f.changements.map(c => [c.cle, c.apres]))
          : f.valeurs,
        enfants: f.enfants
          .filter(e => e.action === 'creer')
          .map(e => Object.fromEntries(COLS_ENFANT.map(k => [k, e.valeurs[k]]))),
      }))

    const { error, resultats } = await enregistrerFoyers(lots)
    setEnCours(false)

    if (error) { toast.error(error); return }
    if (!resultats) return

    setCompteRendu(resultats)

    // Les foyers ECRITS disparaissent du tableau : il ne reste que ce qui
    // demande encore quelque chose. C'est ce qui rend les passes successives
    // lisibles — sinon on relit a chaque fois ce qui est deja fait.
    const ecrits = new Set(resultats.filter(r => r.ok).map(r => r.cle))
    setLignes(prev => prev?.filter(l => {
      const f = resultat.find(x => x.lignes.includes(l.numero))
      return !f || !ecrits.has(f.cle)
    }) ?? null)
    setCochees(new Set())

    const ok = resultats.filter(r => r.ok).length
    const ko = resultats.length - ok
    if (ko === 0) toast.success(`${ok} foyer(s) enregistré(s).`)
    else toast.warning(`${ok} foyer(s) enregistré(s), ${ko} en échec.`)

    router.refresh()
  }

  const basculer = (cle: string) =>
    setCochees(prev => {
      const s = new Set(prev)
      if (s.has(cle)) s.delete(cle)
      else s.add(cle)
      return s
    })

  const totalEnfants = resultat
    .filter(f => cochees.has(f.cle) && f.enregistrable)
    .reduce((n, f) => n + f.enfants.filter(e => e.action === 'creer').length, 0)

  return (
    <div className="space-y-3 animate-fade-in">

      {/* ── Dépôt du fichier ── */}
      <div className="card p-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="stat-label">Fichier à importer</h2>
          {nomFichier && (
            <span className="text-xs text-warm-700">
              Chargé : <span className="font-medium text-secondary-800">{nomFichier}</span>
            </span>
          )}
          {lignes && (
            <span className="text-xs text-warm-700">
              <span className="font-bold text-secondary-800">{resultat.length}</span> foyer(s) ·{' '}
              <span className="font-bold text-secondary-800">{aFaire.length}</span> à enregistrer ·{' '}
              <span className="font-bold text-secondary-800">{cochesValides.size}</span> coché(s)
            </span>
          )}
          <div className="flex-1" />

          {/* Les trois actions, memes forme et taille — c'est le seul moyen
              qu'elles se lisent comme une meme famille. Le telechargement reste
              un vrai LIEN, mais rendu par le meme composant : une apparence
              recopiee a la main finit toujours par diverger, et c'est
              exactement ce qui s'etait produit.

              Aucune icone : regle du projet, un bouton a libelle porte son
              libelle seul.

              « Enregistrer la sélection » vit ICI et non en pied de tableau,
              pour rester visible quel que soit le defilement. */}
          <FloatButton variant="edit" href="/gabarit-import-apprenants.xlsx" download>
            Télécharger le modèle
          </FloatButton>

          <FloatButton variant="edit" type="button" onClick={() => inputRef.current?.click()}>
            Importer le fichier
          </FloatButton>

          {lignes && (
            <FloatButton
              type="button"
              variant="submit"
              disabled={cochesValides.size === 0 || enCours}
              loading={enCours}
              onClick={() => setConfirmer(true)}
            >
              Enregistrer la sélection
            </FloatButton>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={e => {
            const f = e.target.files?.[0]
            if (f) charger(f)
            // Remis a zero : sans cela, redeposer LE MEME fichier apres
            // correction ne declencherait aucun evenement.
            e.target.value = ''
          }}
        />

        {avertissementsFichier.map((a, i) => (
          <p key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
            <AlertTriangle size={13} className="flex-shrink-0" />
            {a}
          </p>
        ))}
      </div>

      {/* ── Compte rendu du dernier enregistrement ── */}
      {compteRendu && (
        <div className="card p-3 space-y-1.5">
          <h2 className="stat-label">Dernier enregistrement</h2>
          {compteRendu.map(r => (
            <p key={r.cle} className="text-xs flex items-start gap-1.5">
              {r.ok
                ? <Check size={13} className="text-primary-600 flex-shrink-0 mt-0.5" />
                : <X size={13} className="text-red-600 flex-shrink-0 mt-0.5" />}
              <span className={r.ok ? 'text-warm-700' : 'text-red-700'}>
                <span className="font-medium text-secondary-800">{r.libelle}</span>
                {r.ok
                  ? ` · ${r.foyerCree ? 'foyer créé' : 'foyer mis à jour'}`
                    + (r.enfantsCrees ? ` · ${r.enfantsCrees} apprenant(s) : ${r.numeros?.join(', ')}` : '')
                  : ` · ${r.message}`}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* ── Le tableau ── */}
      {lignes && resultat.length > 0 && (
        <>
          <div className="card p-0 overflow-hidden">
            <div className="max-h-[78vh] overflow-y-auto list-scroll">
              <table className="w-full text-left text-xs" aria-label="Familles du fichier">
                <thead className="sticky top-0 z-10 bg-[var(--surface-card)]">
                  <tr className="border-b border-warm-100">
                    <th scope="col" className="list-th w-10">
                      {/* Case d'en-tete a TROIS etats — cochee, partielle, vide —
                          plutot que deux liens de texte en pied de tableau. Elle
                          est la ou l'on coche, et un seul controle remplace les
                          deux.

                          Desactivee et non masquee quand rien n'est valide : un
                          controle qui disparait se lit comme un bug, un controle
                          grise se lit comme un refus. */}
                      <input
                        type="checkbox"
                        ref={el => { if (el) el.indeterminate = partiel }}
                        checked={aFaire.length > 0 && cochesValides.size === aFaire.length}
                        disabled={aFaire.length === 0}
                        onChange={() => setCochees(
                          cochesValides.size === aFaire.length ? new Set() : new Set(aFaire.map(f => f.cle)),
                        )}
                        aria-label={cochesValides.size === aFaire.length ? 'Tout décocher' : 'Cocher tous les foyers enregistrables'}
                        title={cochesValides.size === aFaire.length ? 'Tout décocher' : 'Cocher tout ce qui est enregistrable'}
                        className="accent-primary-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </th>
                    <th scope="col" className="list-th w-64">Foyer</th>
                    <th scope="col" className="list-th w-52">Action</th>
                    <th scope="col" className="list-th">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100">
                  {resultat.map(f => (
                    <LigneFoyer
                      key={f.cle}
                      foyer={f}
                      coche={cochees.has(f.cle)}
                      onBasculer={() => basculer(f.cle)}
                      deplie={deplie.has(f.cle)}
                      onDeplier={() => setDeplie(p => {
                        const s = new Set(p)
                        if (s.has(f.cle)) s.delete(f.cle)
                        else s.add(f.cle)
                        return s
                      })}
                      onModifier={modifier}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}

      {confirmer && (
        <ConfirmModal
          title="Enregistrer les familles cochées ?"
          message={`${cochesValides.size} foyer(s) et ${totalEnfants} apprenant(s) vont être écrits. Les foyers enregistrés disparaîtront du tableau.`}
          confirmLabel="Enregistrer"
          confirmColor="amber"
          onConfirm={enregistrer}
          onCancel={() => setConfirmer(false)}
        />
      )}
    </div>
  )
}

// ─── Une ligne de foyer, et ses enfants ──────────────────────────────────────

function LigneFoyer({
  foyer, coche, onBasculer, deplie, onDeplier, onModifier,
}: {
  foyer: FoyerRapproche
  coche: boolean
  onBasculer: () => void
  deplie: boolean
  onDeplier: () => void
  onModifier: (ligne: number, cle: string, valeur: string) => void
}) {
  const style = STYLE_ACTION[foyer.action]
  const nom = `${foyer.valeurs.tutor1_last_name ?? '?'} ${foyer.valeurs.tutor1_first_name ?? '?'}`
  const premiereLigne = foyer.lignes[0]

  return (
    <tr className={style.fond}>
      <td className="list-td align-top pt-2">
        {/* Grisée et non masquée : une case qui disparaît se lit comme un bug,
            une case grisée se lit comme un refus — et le motif est juste à côté. */}
        <input
          type="checkbox"
          checked={coche}
          disabled={!foyer.enregistrable}
          onChange={onBasculer}
          aria-label={`Enregistrer le foyer ${nom}`}
          className="accent-primary-600 disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </td>

      <td className="list-td align-top pt-1.5">
        <div className="list-name text-secondary-800">{nom}</div>
        <div className="text-[11px] text-warm-700">
          {foyer.lignes.length > 1
            ? `lignes ${foyer.lignes.join(', ')}`
            : `ligne ${foyer.lignes[0]}`}
        </div>
        <button
          type="button"
          onClick={onDeplier}
          aria-expanded={deplie}
          className="text-[11px] text-primary-700 hover:text-primary-800 underline underline-offset-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        >
          {deplie ? 'Masquer les coordonnées' : 'Voir et corriger les coordonnées'}
        </button>
      </td>

      <td className="list-td align-top pt-2">
        <Pastille style={style.pastille}>{style.libelle}</Pastille>
      </td>

      <td className="list-td align-top pt-1.5 space-y-2">
        {/* Ce qui change, avant/apres — on ne coche pas une mise a jour en
            esperant que la machine fera bien. */}
        {foyer.changements.length > 0 && (
          <div className="space-y-0.5">
            {foyer.changements.map(c => (
              <div key={c.cle} className="text-[11px] text-amber-700">
                {libelleColonne(c.cle)} : <span className="line-through">{c.avant || '(vide)'}</span> → <span className="font-medium">{c.apres}</span>
              </div>
            ))}
          </div>
        )}

        {/* Anomalies du FOYER (pas d'une cellule) : elles n'ont pas de champ ou
            se poser, elles restent donc en tete. */}
        {foyer.anomalies.map((a, i) => (
          <div key={i} className={`text-[11px] ${STYLE_GRAVITE[a.gravite]}`}>{a.message}</div>
        ))}

        {/* ── Les enfants ────────────────────────────────────────────────────
            Chaque champ porte son LIBELLE. Un placeholder ne suffit pas : il
            disparait des que la cellule est remplie, et on se retrouve devant
            quatre cases dont on ignore ce qu'elles contiennent. */}
        {/* DEUX COLONNES : une famille de quatre enfants occupait quatre blocs
            empiles, et le tableau devenait interminable. A deux de front, la
            hauteur est divisee par deux sans rien perdre. La grille se replie
            d'elle-meme sur un ecran etroit. */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-1.5">
        {foyer.enfants.map(e => (
          <div key={e.ligne} className="rounded-lg border border-warm-100 p-1.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-warm-700">
                Apprenant · ligne {e.ligne}
              </span>
              <Pastille style={STYLE_ENFANT[e.action].pastille}>
                {STYLE_ENFANT[e.action].libelle}
              </Pastille>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5">
              {COLS_ENFANT.map(cle => (
                <Champ
                  key={cle}
                  libelle={libelleColonne(cle)}
                  // ── ENFANT DEJA ENREGISTRE : CHAMPS VERROUILLES ──────────
                  //
                  // Modifier son identite ici ne le RENOMMERAIT pas : l'import
                  // cree sans jamais renommer, donc changer un prenom
                  // fabriquerait un SECOND dossier. C'est exactement l'accident
                  // du 24 aout — « Enfant » puis « Enfant 1 », meme date, meme
                  // foyer. Il n'y a donc aucune modification utile a faire ici,
                  // et le champ le dit.
                  //
                  // Les coordonnees du FOYER, elles, restent modifiables : les
                  // changer produit une vraie mise a jour, c'est un usage legitime.
                  lecture={e.action === 'rien'}
                  titreLecture="Déjà enregistré : le prénom se corrige sur la fiche de l'apprenant."
                  valeur={valeurAffichee(cle, e.valeurs, e.bruts)}
                  erreur={e.anomalies.find(a => a.cle === cle)?.message}
                  onChange={(v: string) => onModifier(e.ligne, cle, v)}
                />
              ))}
            </div>

            {/* Ce qui ne vise aucun champ : doublon interne, enfant deja
                rattache ailleurs. */}
            {e.anomalies.filter(a => !a.cle).map((a, i) => (
              <div key={i} className={`text-[11px] ${STYLE_GRAVITE[a.gravite]}`}>{a.message}</div>
            ))}
          </div>
        ))}
        </div>

        {/* ── Coordonnees du foyer, depliables ──────────────────────────────── */}
        {deplie && (
          <div className="rounded-lg border border-warm-100 p-1.5 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-warm-700">
              Coordonnées du foyer
            </span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-1.5">
              {COLONNES.filter(c => c.cible !== 'enfant').map(c => (
                <Champ
                  key={c.cle}
                  libelle={c.entete}
                  obligatoire={c.obligatoire}
                  lecture={!!foyer.existantId && CLES_IDENTITE_FOYER.includes(c.cle)}
                  titreLecture="Foyer déjà enregistré : les noms des tuteurs se corrigent sur la fiche parents."
                  valeur={valeurAffichee(c.cle, foyer.valeurs, foyer.bruts)}
                  erreur={foyer.erreursChamps[c.cle]}
                  onChange={(v: string) => onModifier(premiereLigne, c.cle, v)}
                />
              ))}
            </div>
          </div>
        )}
      </td>
    </tr>
  )
}

/**
 * Un champ corrigeable : libelle au-dessus, message d'erreur en dessous.
 *
 * ┌─ TROIS CHOSES QUE L'ANCIENNE VERSION FAISAIT MAL ────────────────────────┐
 * │ · Elle n'avait qu'un PLACEHOLDER, qui disparait des que la cellule est    │
 * │   remplie : on se retrouvait devant quatre cases sans savoir ce qu'elles  │
 * │   contenaient.                                                            │
 * │ · Elle affichait un champ VIDE quand la valeur avait ete refusee, si bien │
 * │   qu'il fallait tout resaisir alors qu'une lettre manquait souvent.       │
 * │ · Elle empilait les messages en bout de ligne, loin du champ vise.        │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * La revalidation se fait au BLUR et non a chaque frappe : normaliser pendant
 * la saisie mettrait le nom en majuscules sous les doigts de l'utilisateur, qui
 * ne saurait plus ou il en est.
 */
function Champ({
  libelle, valeur, erreur, obligatoire, lecture, titreLecture, onChange,
}: {
  libelle: string
  valeur: string | null
  erreur?: string
  obligatoire?: boolean
  /** Champ verrouille : rien d'utile ne peut y etre modifie. */
  lecture?: boolean
  /** Ce qu'on explique au survol d'un champ verrouille. */
  titreLecture?: string
  onChange: (v: string) => void
}) {
  const [saisi, setSaisi] = useState<string | null>(null)
  const affiche = saisi ?? valeur ?? ''

  return (
    <label className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wide text-warm-700 truncate">
        {libelle}
        {obligatoire && <span className="text-red-500"> *</span>}
      </span>
      <input
        type="text"
        value={affiche}
        aria-label={libelle}
        aria-invalid={!!erreur}
        readOnly={lecture}
        title={lecture ? titreLecture : undefined}
        onChange={e => setSaisi(e.target.value)}
        onBlur={() => {
          if (lecture) return
          if (saisi !== null && saisi !== (valeur ?? '')) onChange(saisi)
          setSaisi(null)
        }}
        className={`w-full px-1.5 py-0.5 text-[11px] rounded border outline-none ${
          lecture
            ? 'border-warm-200 bg-warm-100 text-warm-700 cursor-not-allowed'
            : erreur
              ? 'border-red-400 bg-[var(--surface-card)] text-secondary-800 focus:border-red-500 focus:ring-1 focus:ring-primary-500/40'
              : 'border-warm-200 bg-[var(--surface-card)] text-secondary-800 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/40'
        }`}
      />
      {erreur && <span className="text-[10px] text-red-700 leading-tight">{erreur}</span>}
    </label>
  )
}
