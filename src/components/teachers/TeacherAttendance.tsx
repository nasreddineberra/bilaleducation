'use client'

import { Clock } from 'lucide-react'
import ListStatCard from '@/components/ui/ListStatCard'
import TruncatedText from '@/components/ui/TruncatedText'
import { fmtDuration } from '@/lib/temps-presence/format'

/**
 * ASSIDUITE D'UN ENSEIGNANT — onglet en LECTURE SEULE de sa fiche.
 *
 * ┌─ CE QUE CET ECRAN NE FAIT PAS ───────────────────────────────────────────┐
 * │ Il ne saisit rien. Le temps de presence a son module, avec ses gardes et  │
 * │ son calendrier ; dupliquer ici un chemin d'ecriture, ce serait deux       │
 * │ ecrans a tenir coherents sur la meme table.                               │
 * │                                                                           │
 * │ Il ne CALCULE rien non plus : les lignes arrivent resolues de la page,    │
 * │ qui a acces aux noms et aux types de presence. Le navigateur ne reçoit    │
 * │ donc pas la table des saisies pour en extraire trois chiffres.           │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Ce qui est affiche vient de `staff_time_entries`, et la RLS decide seule de
 * ce qui est lisible : l'encadrement voit tout, un enseignant ne voit que ses
 * propres lignes — donc sa propre fiche. Aucune garde de role n'est posee ici,
 * elle ferait doublon avec la base et divergerait d'elle.
 */

export interface AbsenceLigne {
  id: string
  /** `AAAA-MM-JJ`. */
  date: string
  start: string
  end: string
  minutes: number
  motif: string | null
  /** `NOM Prenom` des personnes qui ont assure le creneau, deja construits. */
  remplacants: string[]
}

export interface RemplacementLigne {
  id: string
  date: string
  start: string
  end: string
  minutes: number
  /** `NOM Prenom` de la personne remplacee, ou null si son compte a ete supprime. */
  remplace: string | null
}

interface Props {
  /** Une fiche sans compte de connexion ne pointe pas : il n'y a rien a montrer. */
  hasAccount: boolean
  yearLabel: string | null
  workedMinutes: number
  absenceMinutes: number
  absences: AbsenceLigne[]
  remplacements: RemplacementLigne[]
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
 * Marque du pluriel.
 *
 * En français, ZERO reste au singulier (« 0 remplacement assuré ») : le seuil
 * est donc `> 1`, jamais `!== 1`. C'est la faute qu'accorder « à l'œil » produit
 * systématiquement, et elle ne se voit qu'une fois le compteur à 0 devant soi.
 */
function pl(n: number): string {
  return n > 1 ? 's' : ''
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
    <div className="card p-6 text-center w-full">
      <Clock size={28} className="text-warm-700 mx-auto" />
      <p className="text-sm text-warm-700 mt-2">{texte}</p>
    </div>
  )
}

export default function TeacherAttendance({
  hasAccount,
  yearLabel,
  workedMinutes,
  absenceMinutes,
  absences,
  remplacements,
}: Props) {

  if (!hasAccount) {
    return <EtatVide texte="Cet enseignant n'a pas de compte de connexion : aucune présence ne lui est rattachée." />
  }

  if (!yearLabel) {
    return <EtatVide texte="Aucune année scolaire en cours : l'assiduité se lit sur une année." />
  }

  return (
    // w-fit sur le conteneur + w-full sur les encadres : ils prennent tous la
    // meme largeur, celle du plus large des contenus, sans valeur en dur.
    // Meme montage que l'onglet Documents, pour que les deux s'alignent.
    <div className="space-y-4 w-fit">

      {/* ── Synthese de l'annee ── */}
      <div className="flex flex-wrap gap-2 w-full">
        <ListStatCard
          value={fmtDuration(workedMinutes)}
          label={<>Heures assurées<br />{yearLabel}</>}
          valueColor="text-secondary-800"
        />
        <ListStatCard
          value={absences.length}
          label={
            <>
              absence{pl(absences.length)}
              <br />
              {/* « manquée » s'accorde avec les HEURES, pas avec le nombre
                  d'absences : une seule absence peut peser trois heures. */}
              {fmtDuration(absenceMinutes)} manquée{pl(absenceMinutes / 60)}
            </>
          }
          valueColor={absences.length > 0 ? 'text-red-600' : 'text-secondary-800'}
        />
        <ListStatCard
          value={remplacements.length}
          label={
            <>
              remplacement{pl(remplacements.length)}
              <br />
              assuré{pl(remplacements.length)} pour {remplacements.length > 1 ? 'des collègues' : 'un collègue'}
            </>
          }
          valueColor={remplacements.length > 0 ? 'text-primary-600' : 'text-secondary-800'}
        />
      </div>

      {/* ── Absences ── */}
      <div className="space-y-2 w-full">
        <h2 className="stat-label">Absences</h2>

        {absences.length === 0 ? (
          <div className="card p-4 text-center w-full">
            <p className="text-sm text-warm-700">Aucune absence enregistrée cette année.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden w-full">
            <table className="w-full text-left text-xs" aria-label="Absences de l'enseignant">
              <thead>
                <tr className="border-b border-warm-100">
                  <th scope="col" className="list-th w-36">Date</th>
                  <th scope="col" className="list-th w-32">Horaires</th>
                  <th scope="col" className="list-th w-20 text-center">Durée</th>
                  <th scope="col" className="list-th w-48">Motif</th>
                  <th scope="col" className="list-th">Remplacé par</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {absences.map(a => (
                  <tr key={a.id} className="hover:bg-warm-50/50 transition-colors">
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
                      ) : (
                        // Un creneau manque sans personne pour le tenir n'est pas
                        // un detail administratif : c'est une classe sans adulte.
                        <span className="text-red-600 font-medium">Non remplacé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Remplacements assures pour d'autres ── */}
      <div className="space-y-2 w-full">
        <h2 className="stat-label">Remplacements assurés</h2>

        {remplacements.length === 0 ? (
          <div className="card p-4 text-center w-full">
            <p className="text-sm text-warm-700">Aucun remplacement assuré cette année.</p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden w-full">
            <table className="w-full text-left text-xs" aria-label="Remplacements assurés par l'enseignant">
              <thead>
                <tr className="border-b border-warm-100">
                  <th scope="col" className="list-th w-36">Date</th>
                  <th scope="col" className="list-th w-32">Horaires</th>
                  <th scope="col" className="list-th w-20 text-center">Durée</th>
                  <th scope="col" className="list-th">À la place de</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {remplacements.map(r => (
                  <tr key={r.id} className="hover:bg-warm-50/50 transition-colors">
                    <td className="list-td whitespace-nowrap text-secondary-700">{fmtDate(r.date)}</td>
                    <td className="list-td whitespace-nowrap tabular-nums text-warm-700">{fmtPlage(r.start, r.end)}</td>
                    <td className="list-td text-center tabular-nums text-warm-700">{fmtDuration(r.minutes)}</td>
                    <td className="list-td text-secondary-700">{r.remplace ?? '·'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
