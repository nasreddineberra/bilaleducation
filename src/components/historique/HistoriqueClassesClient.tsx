'use client'

import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { FloatButton, FloatSelect, SearchField } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'

type Periode = { nom: string; du: string | null; au: string | null }
type Creneau = { jour: string | null; debut: string | null; fin: string | null; salle: string | null; du: string | null; au: string | null }
type Participant = { type: 'eleve' | 'adulte'; nom: string; prenom: string; numero: string | null }

export interface ClasseArchivee {
  id: string
  year_label: string
  class_name: string
  level: string | null
  cotisation_label: string | null
  is_adult: boolean
  max_students: number | null
  titulaires: Periode[]
  remplacements: Periode[]
  creneaux: Creneau[]
  participants: Participant[]
  effectif: number
}

// Recherche insensible aux accents et a la casse.
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const fmtDate = (d: string | null) => {
  if (!d) return null
  const [y, m, j] = d.slice(0, 10).split('-')
  return `${j}/${m}/${y}`
}
const plage = (du: string | null, au: string | null) => {
  const a = fmtDate(du), b = fmtDate(au)
  if (a && b) return `${a} - ${b}`
  if (a) return `depuis le ${a}`
  if (b) return `jusqu'au ${b}`
  return null
}
const libelleCreneau = (c: Creneau) =>
  [c.jour, c.debut && c.fin ? `${c.debut}-${c.fin}` : c.debut, c.salle].filter(Boolean).join(' · ')

// Le titulaire « de l'annee » : celui sans date de fin, sinon le dernier en date.
const titulaireAffiche = (t: Periode[]) =>
  t.find(x => !x.au)?.nom ?? t[t.length - 1]?.nom ?? null

export default function HistoriqueClassesClient({ classes }: { classes: ClasseArchivee[] }) {
  const annees = useMemo(() => [...new Set(classes.map(c => c.year_label))], [classes])

  // Annee et recherche memorisees : on ouvre une classe, on revient, on retrouve
  // la meme vue. Voir `useFiltresMemorises`.
  const [etat, setEtat] = useFiltresMemorises('historique-classes', { annee: '', search: '' })
  const annee = annees.includes(etat.annee) ? etat.annee : (annees[0] ?? '')
  const search = etat.search

  const [ouverte, setOuverte] = useState<ClasseArchivee | null>(null)

  const lignes = useMemo(() => {
    const q = norm(search.trim())
    return classes
      .filter(c => c.year_label === annee)
      .filter(c => {
        if (!q) return true
        // Classe, enseignants ou participants : « dans quelle classe etait X ? »
        const textes = [
          c.class_name, c.level ?? '', c.cotisation_label ?? '',
          ...c.titulaires.map(t => t.nom), ...c.remplacements.map(r => r.nom),
          ...c.participants.map(p => `${p.nom} ${p.prenom}`),
        ]
        return textes.some(t => norm(t).includes(q))
      })
  }, [classes, annee, search])

  if (annees.length === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <History size={32} className="mx-auto text-warm-700 mb-2" aria-hidden="true" />
        <p className="text-sm text-warm-700">Aucune année archivée pour le moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <SearchField
          value={search}
          onChange={v => setEtat({ search: v })}
          placeholder="Classe, enseignant, élève…"
          ariaLabel="Rechercher une classe, un enseignant ou un participant"
        />
        <FloatSelect
          label="Année"
          compact
          aria-label="Choisir l'année archivée"
          wrapperClassName="w-fit ml-auto"
          value={annee}
          onChange={e => setEtat({ annee: e.target.value })}
        >
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </FloatSelect>
      </div>

      {lignes.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <History size={32} className="mx-auto text-warm-700 mb-2" aria-hidden="true" />
          <p className="text-sm text-warm-700">Aucune classe ne correspond.</p>
        </div>
      ) : (
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left text-xs" aria-label={`Classes de l'année ${annee}`}>
          <thead>
            <tr className="border-b border-warm-100">
              <th scope="col" className="list-th">Classe</th>
              <th scope="col" className="list-th">Niveau</th>
              <th scope="col" className="list-th">Cotisation</th>
              <th scope="col" className="list-th">Titulaire</th>
              <th scope="col" className="list-th">Remplacements</th>
              <th scope="col" className="list-th">Créneau</th>
              <th scope="col" className="list-th text-center">Effectif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-50">
            {lignes.map(c => (
              <tr
                key={c.id}
                onClick={() => setOuverte(c)}
                className="hover:bg-warm-100 transition-colors cursor-pointer"
              >
                <td className="list-td">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setOuverte(c) }}
                    className="list-name text-left hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                  >
                    {c.class_name}
                  </button>
                  {c.is_adult && (
                    <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-violet-50 text-violet-700">Adultes</span>
                  )}
                </td>
                <td className="list-td text-warm-700">{c.level || <span className="text-warm-700">·</span>}</td>
                <td className="list-td text-warm-700">{c.cotisation_label || <span className="text-warm-700">·</span>}</td>
                <td className="list-td text-warm-700 whitespace-nowrap">
                  {titulaireAffiche(c.titulaires) ?? <span className="text-warm-700">·</span>}
                </td>
                <td className="list-td text-warm-700">
                  {c.remplacements.length === 0 ? <span className="text-warm-700">·</span> : (
                    <div className="flex flex-col gap-0.5">
                      {c.remplacements.map((r, i) => (
                        <span key={i} className="whitespace-nowrap">
                          {r.nom}{plage(r.du, r.au) ? <span className="text-warm-700"> · {plage(r.du, r.au)}</span> : null}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="list-td text-warm-700">
                  {c.creneaux.length === 0 ? <span className="text-warm-700">·</span> : (
                    <div className="flex flex-col gap-0.5">
                      {c.creneaux.map((cr, i) => <span key={i} className="whitespace-nowrap">{libelleCreneau(cr)}</span>)}
                    </div>
                  )}
                </td>
                <td className="list-td text-center tabular-nums text-secondary-700">
                  {c.effectif}{c.max_students ? <span className="text-warm-700"> / {c.max_students}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {ouverte && (
        <FormModal
          title={`${ouverte.class_name} · ${ouverte.year_label}`}
          onClose={() => setOuverte(null)}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end w-full">
              <FloatButton variant="secondary" onClick={() => setOuverte(null)}>Fermer</FloatButton>
            </div>
          }
        >
          <dl className="text-sm space-y-1.5">
            <div className="flex gap-2"><dt className="stat-label w-28 shrink-0 pt-0.5">Titulaire</dt>
              <dd className="text-secondary-800">
                {ouverte.titulaires.length === 0 ? '·' : ouverte.titulaires.map((t, i) => (
                  <div key={i}>{t.nom}{plage(t.du, t.au) ? <span className="text-warm-700 text-xs"> · {plage(t.du, t.au)}</span> : null}</div>
                ))}
              </dd>
            </div>
            {ouverte.remplacements.length > 0 && (
              <div className="flex gap-2"><dt className="stat-label w-28 shrink-0 pt-0.5">Remplacements</dt>
                <dd className="text-secondary-800">
                  {ouverte.remplacements.map((r, i) => (
                    <div key={i}>{r.nom}{plage(r.du, r.au) ? <span className="text-warm-700 text-xs"> · {plage(r.du, r.au)}</span> : null}</div>
                  ))}
                </dd>
              </div>
            )}
            <div className="flex gap-2"><dt className="stat-label w-28 shrink-0 pt-0.5">Créneau</dt>
              <dd className="text-secondary-800">
                {ouverte.creneaux.length === 0 ? '·' : ouverte.creneaux.map((cr, i) => <div key={i}>{libelleCreneau(cr)}</div>)}
              </dd>
            </div>
          </dl>

          <div className="mt-3">
            <h3 className="section-title mb-1.5">
              {ouverte.is_adult ? 'Participants' : 'Élèves'} ({ouverte.effectif})
            </h3>
            {ouverte.participants.length === 0 ? (
              <p className="text-xs text-warm-700">Aucun participant.</p>
            ) : (
              <ul className="max-h-72 overflow-y-auto list-scroll divide-y divide-warm-50 border border-warm-100 rounded-lg">
                {ouverte.participants.map((p, i) => (
                  <li key={i} className="px-3 py-1.5 text-xs flex items-center justify-between gap-2">
                    <span className="text-secondary-800"><span className="font-semibold">{p.nom.toUpperCase()}</span> {p.prenom}</span>
                    {p.numero && <span className="text-warm-700 tabular-nums">{p.numero}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </FormModal>
      )}
    </div>
  )
}
