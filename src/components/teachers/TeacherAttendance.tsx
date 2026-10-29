'use client'

import { useRouter } from 'next/navigation'
import ListStatCard from '@/components/ui/ListStatCard'
import TruncatedText from '@/components/ui/TruncatedText'
import { fmtDuration } from '@/lib/temps-presence/format'
import type { Assiduite } from '@/lib/temps-presence/assiduite'
import { accord } from '@/lib/texte/pluriel'

/**
 * ASSIDUITE D'UNE PERSONNE — bloc en LECTURE SEULE.
 *
 * ┌─ DEUX ECRANS, UN SEUL COMPOSANT ─────────────────────────────────────────┐
 * │ Onglet Assiduite de la fiche enseignant (lu par l'encadrement) et encadre │
 * │ « Mon temps de presence » de Mon compte (lu par l'interesse). Meme bloc,  │
 * │ mêmes chiffres, par CONSTRUCTION.                                         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Il ne saisit rien. Le temps de presence a son module, avec ses gardes et son
 * calendrier ; un second chemin d'ecriture sur la meme table, ce serait deux
 * ecrans a tenir coherents.
 *
 * Il ne CALCULE rien non plus : tout arrive resolu de `chargerAssiduite`.
 *
 * AUCUN COUT ici, dans aucune des deux vues : ce bloc dit des heures, pas de
 * l'argent.
 */

interface Props extends Assiduite {
  /**
   * Vue resserree, pour Mon compte.
   *
   * Ce n'est pas qu'une affaire de marges : en dense, le bloc ne dessine PLUS
   * ses propres encadres, parce que l'appelant l'enveloppe deja dans un seul.
   * Des cartes dans une carte se lisent comme un defaut de mise en page.
   */
  dense?: boolean
}

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

/**
 * `AAAA-MM-JJ` vers `Lun 08/09/2026`.
 *
 * Decoupage de la CHAINE, jamais `new Date(iso)` : cette forme est lue en UTC et
 * affiche la veille des qu'on est a l'est de Greenwich. Le seul `Date` construit
 * ici l'est a partir des composantes locales, uniquement pour le jour de semaine.
 */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const jour = DAY_NAMES[new Date(Number(y), Number(m) - 1, Number(d)).getDay()]
  return `${jour} ${d}/${m}/${y}`
}

/**
 * `09:00 - 12:00`, ou `·` quand la saisie n'en porte pas.
 *
 * La base autorise des horaires nuls (une garde qui l'interdirait bloquerait la
 * CASCADE des anciennes lignes) ; le formulaire, lui, les exige. Sans ce repli,
 * une ligne ancienne afficherait un tiret solitaire entre deux vides.
 */
function fmtPlage(start: string, end: string): string {
  return start && end ? `${start} - ${end}` : '·'
}

function EtatVide({ texte }: { texte: string }) {
  return (
    <div className="card text-center text-sm text-warm-700 py-10 w-full">{texte}</div>
  )
}

/**
 * Enveloppe d'un tableau : hauteur BORNEE, en-tete collant.
 *
 * Sans borne, une annee chargee pousserait la page — inacceptable sur Mon
 * compte, qui doit tenir sans barre de defilement. Une hauteur figee ferait
 * l'inverse : un encadre a moitie vide pour deux lignes. D'ou `max-h`, qui ne
 * s'applique qu'a partir du moment ou il y a de quoi deborder.
 */
const TITRE_SECTION = 'encadre-titre m-0 text-xs font-bold uppercase tracking-widest'

function TableauBorne({ children, hauteur, dense }: { children: React.ReactNode; hauteur: string; dense: boolean }) {
  return (
    <div className={`${dense ? 'border border-warm-100 rounded-lg' : ''} overflow-hidden w-full`}>
      <div className={`${hauteur} overflow-y-auto list-scroll`}>
        {children}
      </div>
    </div>
  )
}

export default function TeacherAttendance({
  hasAccount,
  yearLabel,
  workedMinutes,
  absenceMinutes,
  nbAbsences,
  mois,
  absences,
  remplacements,
  dense = false,
}: Props) {
  const router = useRouter()

  if (!hasAccount) {
    return <EtatVide texte="Aucun compte de connexion rattaché : aucune présence n'est enregistrée." />
  }

  if (!yearLabel) {
    return <EtatVide texte="Aucune année scolaire en cours : l'assiduité se lit sur une année." />
  }

  // Echelle des barres : le mois le PLUS charge vaut la hauteur pleine. Une
  // echelle absolue (un maximum theorique d'heures) serait arbitraire et
  // ecraserait tout le releve chez qui travaille peu.
  const maxMois = Math.max(...mois.map(m => m.minutes), 1)

  const hauteurTable = dense ? 'max-h-[13rem]' : 'max-h-[22rem]'

  return (
    // LARGEUR FIXE, et surtout pas `w-fit` : la largeur suivait alors le contenu
    // le plus large, donc le TABLEAU DES ABSENCES. Un enseignant qui en a une
    // voyait un bloc large et huit mois par ligne, un enseignant sans absence un
    // bloc etroit et six — la meme fiche changeait de forme selon la personne.
    // Une bande de mois n'est lisible que si elle se lit pareil pour tout le monde.
    <div className={`${dense ? 'space-y-3' : 'space-y-4 w-full max-w-3xl'}`}>

      {/* ── Synthese de l'annee ──
          En dense, une ligne de chiffres plutot que trois cartes : trois cartes
          dans une carte se lisent comme un defaut de mise en page, et la colonne
          de Mon compte n'a pas la largeur de les aligner. */}
      {dense ? (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-warm-700">
          <span>
            <span className="text-sm font-bold text-secondary-800 tabular-nums">{fmtDuration(workedMinutes)}</span>{' '}
            assurées en {yearLabel}
          </span>
          <span>
            <span className={`text-sm font-bold tabular-nums ${nbAbsences > 0 ? 'text-red-700' : 'text-secondary-800'}`}>{nbAbsences}</span>{' '}
            {accord(nbAbsences, 'absence')}
            {nbAbsences > 0 && <> · {fmtDuration(absenceMinutes)} {accord(absenceMinutes / 60, 'manquée')}</>}
          </span>
          <span>
            <span className={`text-sm font-bold tabular-nums ${remplacements.length > 0 ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-secondary-800'}`}>{remplacements.length}</span>{' '}
            {accord(remplacements.length, 'remplacement')} {accord(remplacements.length, 'assuré')}
          </span>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2 w-full">
        <ListStatCard
          value={fmtDuration(workedMinutes)}
          label={<>Heures assurées<br />{yearLabel}</>}
          valueColor="text-secondary-800"
        />
        <ListStatCard
          value={nbAbsences}
          label={
            <>
              {accord(nbAbsences, 'absence')}
              <br />
              {/* « manquée » s'accorde avec les HEURES, pas avec le nombre
                  d'absences : une seule absence peut peser trois heures. */}
              {fmtDuration(absenceMinutes)} {accord(absenceMinutes / 60, 'manquée')}
            </>
          }
          valueColor={nbAbsences > 0 ? 'text-red-700' : 'text-secondary-800'}
        />
        <ListStatCard
          value={remplacements.length}
          label={
            <>
              {accord(remplacements.length, 'remplacement')}
              <br />
              {accord(remplacements.length, 'assuré')} pour {remplacements.length > 1 ? 'des collègues' : 'un collègue'}
            </>
          }
          valueColor={remplacements.length > 0 ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-secondary-800'}
        />
      </div>
      )}

      {/* ── Heures par mois ──
          Les mois sont ceux de l'annee scolaire, engendres depuis ses bornes
          reelles (ici juillet a juillet, soit treize). La grille se replie
          d'elle-meme (`auto-fill`) : la meme bande tient sur la largeur d'une
          fiche comme dans la colonne etroite de Mon compte. */}
      <div className={`${dense ? '' : 'card p-3'} w-full space-y-2`}>
        <div className={dense ? 'flex items-baseline gap-3' : 'encadre-titre gap-3'}>
          <h2 className={dense ? 'stat-label' : 'text-xs font-bold uppercase tracking-widest'}>Heures assurées par mois</h2>
          <div className="flex-1" />
          {!dense && (
            <span className="text-xs text-warm-700">
              Total <span className="font-bold text-secondary-800 tabular-nums">{fmtDuration(workedMinutes)}</span>
            </span>
          )}
        </div>

        {/* 5rem de largeur minimale : sur la fiche (conteneur borne a 48rem) la
            bande tombe sur HUIT mois par ligne, la forme validee. La regle reste
            en `auto-fill` et non en nombre fixe de colonnes, pour que la meme
            bande se replie d'elle-meme dans la colonne etroite de Mon compte. */}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5">
          {mois.map(m => {
            const actif = m.minutes > 0
            return (
              <li
                key={m.cle}
                className="rounded border border-warm-100 px-1 py-1 text-center"
                aria-label={`${m.libelle} : ${actif ? fmtDuration(m.minutes) : 'aucune heure'}`}
              >
                <div className="stat-label leading-tight">{m.libelle}</div>
                <div className={`text-xs font-bold tabular-nums leading-tight ${actif ? 'text-secondary-800' : 'text-warm-400'}`}>
                  {actif ? fmtDuration(m.minutes) : '·'}
                </div>
                {/* Piste toujours dessinee : sans elle, les mois vides
                    perdraient un pixel de hauteur et la bande ondulerait. */}
                <div className="mt-1 h-1 rounded-full bg-warm-100 overflow-hidden">
                  {actif && (
                    <div
                      className="h-full rounded-full bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)]"
                      style={{ width: `${Math.round((m.minutes / maxMois) * 100)}%` }}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Absences ── */}
      <div className={dense ? 'space-y-2 w-full' : 'card p-0 overflow-hidden w-full'}>
        <h2 className={dense ? 'stat-label' : TITRE_SECTION}>Absences</h2>

        {absences.length === 0 ? (
          <div className={`${dense ? 'border border-warm-100 rounded-lg' : ''} p-3 text-center w-full`}>
            <p className="text-sm text-warm-700">Aucune absence enregistrée cette année.</p>
          </div>
        ) : (
          <TableauBorne hauteur={hauteurTable} dense={dense}>
            <table className="liste w-full text-left text-xs" aria-label="Absences">
              <thead className="sticky top-0 z-10">
                <tr className="liste-entete border-b border-[var(--card-border)]">
                  <th scope="col" className="list-th w-36">Date</th>
                  <th scope="col" className="list-th w-32">Horaires</th>
                  <th scope="col" className="list-th w-20 text-center">Durée</th>
                  <th scope="col" className="list-th w-48">Motif</th>
                  <th scope="col" className="list-th">Remplacé par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {absences.map(a => (
                  // Seance d'une absence d'enseignant : la ligne ouvre la fiche
                  // de l'absence (decisions, remplacant).
                  <tr key={a.id}
                    onClick={a.absenceId ? () => router.push(`/dashboard/absences-enseignants/${a.absenceId}`) : undefined}
                    className={a.absenceId ? 'cursor-pointer' : undefined}>
                    <td className="list-td whitespace-nowrap text-secondary-700">{fmtDate(a.date)}</td>
                    <td className="list-td whitespace-nowrap tabular-nums text-warm-700">{fmtPlage(a.start, a.end)}</td>
                    <td className="list-td text-center tabular-nums text-warm-700">{fmtDuration(a.minutes)}</td>
                    <td className="list-td text-warm-700">
                      {/* Largeur portee par un bloc INTERIEUR, pas par la cellule :
                          en disposition de tableau automatique, un `max-width` sur
                          `<td>` est ignore par le navigateur, et le motif long
                          etirerait la colonne jusqu'a chasser « Remplacé par ». */}
                      <div className="w-44 flex">
                        {a.motif ? <TruncatedText text={a.motif} /> : <span>·</span>}
                      </div>
                    </td>
                    <td className="list-td">
                      {a.remplacants.length > 0 ? (
                        <span className="text-secondary-700">{a.remplacants.join(' · ')}</span>
                      ) : a.etat === 'annulee' ? (
                        <span className="text-warm-700">Séance annulée</span>
                      ) : a.etat === 'a_decider' ? (
                        <span className="text-amber-700 font-medium">À décider</span>
                      ) : (
                        // Un creneau manque sans personne pour le tenir n'est pas
                        // un detail administratif : c'est une classe sans adulte.
                        <span className="text-red-700 font-medium">Non remplacé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableauBorne>
        )}
      </div>

      {/* ── Remplacements assures pour d'autres ── */}
      <div className={dense ? 'space-y-2 w-full' : 'card p-0 overflow-hidden w-full'}>
        <h2 className={dense ? 'stat-label' : TITRE_SECTION}>Remplacements assurés</h2>

        {remplacements.length === 0 ? (
          <div className={`${dense ? 'border border-warm-100 rounded-lg' : ''} p-3 text-center w-full`}>
            <p className="text-sm text-warm-700">Aucun remplacement assuré cette année.</p>
          </div>
        ) : (
          <TableauBorne hauteur={hauteurTable} dense={dense}>
            <table className="liste w-full text-left text-xs" aria-label="Remplacements assurés">
              <thead className="sticky top-0 z-10">
                <tr className="liste-entete border-b border-[var(--card-border)]">
                  <th scope="col" className="list-th w-36">Date</th>
                  <th scope="col" className="list-th w-32">Horaires</th>
                  <th scope="col" className="list-th w-20 text-center">Durée</th>
                  <th scope="col" className="list-th">À la place de</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {remplacements.map(r => (
                  <tr key={r.id}>
                    <td className="list-td whitespace-nowrap text-secondary-700">{fmtDate(r.date)}</td>
                    <td className="list-td whitespace-nowrap tabular-nums text-warm-700">{fmtPlage(r.start, r.end)}</td>
                    <td className="list-td text-center tabular-nums text-warm-700">{fmtDuration(r.minutes)}</td>
                    <td className="list-td text-secondary-700">{r.remplace ?? '·'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableauBorne>
        )}
      </div>

    </div>
  )
}
