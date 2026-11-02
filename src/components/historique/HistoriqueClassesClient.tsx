'use client'

import { useMemo, useState } from 'react'
import { FloatButton, FloatSelect, SearchField } from '@/components/ui/FloatFields'
import FormModal from '@/components/ui/FormModal'
import Onglets, { classeOnglet } from '@/components/ui/Onglets'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'
import { libelleTitulaires } from '@/lib/teachers/titulaire'
import { sanitize } from '@/lib/security/sanitize'
import { pluriel } from '@/lib/texte/pluriel'
import type {
  ArchiveCreneau as Creneau, ArchiveParticipant as Participant, ArchivePeriode as Periode,
  ArchiveRemplacement as Remplacement, ArchiveSeance as Seance,
} from '@/types/json'

export interface ClasseArchivee {
  id: string
  year_label: string
  class_name: string
  level: string | null
  cotisation_label: string | null
  is_adult: boolean
  max_students: number | null
  titulaires: Periode[]
  remplacements: Remplacement[]
  cahier_texte: Seance[]
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
  if (a && b) return `du ${a} au ${b}`
  if (a) return `depuis le ${a}`
  if (b) return `jusqu'au ${b}`
  return null
}
const libelleCreneau = (c: Creneau) =>
  [c.jour, c.debut && c.fin ? `${c.debut}-${c.fin}` : c.debut, c.salle].filter(Boolean).join(' · ')

/** « 3 séances remplacées · 1 séance annulée » : resume de la colonne Remplacements. */
const resumeRemplacements = (r: Remplacement[]) => {
  const annulees = r.filter(x => !x.remplacant).length
  const remplacees = r.length - annulees
  return [
    remplacees ? pluriel(remplacees, 'séance remplacée', 'séances remplacées') : null,
    annulees ? pluriel(annulees, 'séance annulée', 'séances annulées') : null,
  ].filter(Boolean).join(' · ')
}

type Onglet = 'participants' | 'remplacements' | 'cahier'


export default function HistoriqueClassesClient({ classes }: { classes: ClasseArchivee[] }) {
  const annees = useMemo(() => [...new Set(classes.map(c => c.year_label))], [classes])

  // Annee et recherche memorisees : on ouvre une classe, on revient, on retrouve
  // la meme vue. Voir `useFiltresMemorises`.
  const [etat, setEtat] = useFiltresMemorises('historique-classes', { annee: '', search: '' })
  const annee = annees.includes(etat.annee) ? etat.annee : (annees[0] ?? '')
  const search = etat.search

  const [ouverte, setOuverte] = useState<ClasseArchivee | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('participants')
  const ouvrir = (c: ClasseArchivee) => { setOnglet('participants'); setOuverte(c) }

  const lignes = useMemo(() => {
    const q = norm(search.trim())
    return classes
      .filter(c => c.year_label === annee)
      .filter(c => {
        if (!q) return true
        // Classe, enseignants ou participants : « dans quelle classe etait X ? »
        const textes = [
          c.class_name, c.level ?? '', c.cotisation_label ?? '',
          ...c.titulaires.map(t => t.nom), ...c.remplacements.flatMap(r => [r.absent, r.remplacant ?? '']),
          ...c.participants.map(p => `${p.nom} ${p.prenom}`),
        ]
        return textes.some(t => norm(t).includes(q))
      })
  }, [classes, annee, search])

  if (annees.length === 0) {
    return (
      <div className="card text-center text-sm text-warm-700 py-10">Aucune année archivée pour le moment.</div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3 flex-shrink-0">
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
        <div className="card text-center text-sm text-warm-700 py-10">Aucune classe ne correspond.</div>
      ) : (
      <div className="liste list-scroll flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-left text-xs" aria-label={`Classes de l'année ${annee}`}>
          <thead className="sticky top-0 z-10">
            <tr className="liste-entete border-b border-[var(--card-border)]">
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
                onClick={() => ouvrir(c)}
                className="cursor-pointer"
              >
                <td className="list-td">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); ouvrir(c) }}
                    className="list-name text-left hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
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
                  {/* Historique : « initial puis remplacant » (decision du 30/10) ; le detail garde la liste datee. */}
                  {libelleTitulaires(c.titulaires) ?? <span className="text-warm-700">·</span>}
                </td>
                <td className="list-td text-warm-700 whitespace-nowrap">
                  {c.remplacements.length === 0 ? <span className="text-warm-700">·</span> : resumeRemplacements(c.remplacements)}
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
          maxWidth="max-w-2xl"
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
            <div className="flex gap-2"><dt className="stat-label w-28 shrink-0 pt-0.5">Créneau</dt>
              <dd className="text-secondary-800">
                {ouverte.creneaux.length === 0 ? '·' : ouverte.creneaux.map((cr, i) => <div key={i}>{libelleCreneau(cr)}</div>)}
              </dd>
            </div>
          </dl>

          <Onglets ariaLabel="Détail de la classe archivée" actifIndex={onglet === 'participants' ? 0 : onglet === 'remplacements' ? 1 : 2} className="mt-3 mb-2">
            <button type="button" role="tab" aria-selected={onglet === 'participants'} className={classeOnglet(onglet === 'participants')} onClick={() => setOnglet('participants')}>
              {ouverte.is_adult ? 'Participants' : 'Élèves'} ({ouverte.effectif})
            </button>
            <button type="button" role="tab" aria-selected={onglet === 'remplacements'} className={classeOnglet(onglet === 'remplacements')} onClick={() => setOnglet('remplacements')}>
              Remplacements ({ouverte.remplacements.length})
            </button>
            <button type="button" role="tab" aria-selected={onglet === 'cahier'} className={classeOnglet(onglet === 'cahier')} onClick={() => setOnglet('cahier')}>
              Cahier de texte ({ouverte.cahier_texte.length})
            </button>
          </Onglets>

          {onglet === 'remplacements' && (
            ouverte.remplacements.length === 0 ? (
              <p className="text-xs text-warm-700">Aucune séance remplacée ni annulée.</p>
            ) : (
              <div className="liste list-scroll max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs" aria-label="Remplacements">
                  <thead className="sticky top-0 z-10">
                    <tr className="liste-entete border-b border-[var(--card-border)]">
                      <th scope="col" className="list-th">Séance</th>
                      <th scope="col" className="list-th">Absent</th>
                      <th scope="col" className="list-th">Décision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-50">
                    {ouverte.remplacements.map((r, i) => (
                      <tr key={i}>
                        <td className="list-td text-secondary-800 tabular-nums whitespace-nowrap">
                          {fmtDate(r.date)}{r.debut && r.fin ? <span className="text-warm-700"> · {r.debut}-{r.fin}</span> : null}
                        </td>
                        <td className="list-td text-secondary-800">{r.absent || '·'}</td>
                        <td className="list-td text-secondary-800">{r.remplacant ? `Remplacée par ${r.remplacant}` : 'Annulée'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {onglet === 'cahier' && (
            ouverte.cahier_texte.length === 0 ? (
              <p className="text-xs text-warm-700">Cahier de texte vide.</p>
            ) : (
              <div className="list-scroll max-h-96 overflow-y-auto space-y-2 pr-1">
                {ouverte.cahier_texte.map((s, i) => (
                  <article key={i} className="rounded-lg border border-[var(--card-border)] px-3 py-2 space-y-1">
                    <p className="text-xs font-semibold text-secondary-800">
                      <span className="tabular-nums">{fmtDate(s.date)}</span>{s.titre ? ` · ${s.titre}` : s.contenu ? '' : ' · Devoir hors séance'}{s.matiere ? ` · ${s.matiere}` : ''}
                    </p>
                    {s.contenu && (
                      <div className="prose prose-sm max-w-none text-warm-700 text-xs" dangerouslySetInnerHTML={{ __html: sanitize(s.contenu) }} />
                    )}
                    {s.devoirs.map((d, j) => (
                      <div key={j} className="border-l-2 border-[var(--brand-line)] pl-2">
                        <p className="text-xs font-medium text-secondary-800">
                          Devoir · {d.titre}{d.matiere ? ` · ${d.matiere}` : ''}{d.rendu ? <span className="text-warm-700"> · à rendre le {fmtDate(d.rendu)}</span> : null}
                        </p>
                        {d.consigne && (
                          <div className="prose prose-sm max-w-none text-warm-700 text-xs" dangerouslySetInnerHTML={{ __html: sanitize(d.consigne) }} />
                        )}
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )
          )}

          {onglet === 'participants' && (
          <div>
            {ouverte.participants.length === 0 ? (
              <p className="text-xs text-warm-700">Aucun participant.</p>
            ) : (
              <div className="liste list-scroll max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs" aria-label={ouverte.is_adult ? 'Participants' : 'Élèves'}>
                  <thead className="sticky top-0 z-10">
                    <tr className="liste-entete border-b border-[var(--card-border)]">
                      <th scope="col" className="list-th">Nom</th>
                      <th scope="col" className="list-th text-right">N°</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-50">
                    {ouverte.participants.map((p, i) => (
                      <tr key={i}>
                        <td className="list-td text-secondary-800"><span className="font-semibold">{p.nom.toUpperCase()}</span> {p.prenom}</td>
                        <td className="list-td text-right text-warm-700 tabular-nums">{p.numero ?? '·'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </FormModal>
      )}
    </div>
  )
}
