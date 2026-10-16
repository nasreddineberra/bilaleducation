'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { usePetitEcran } from '@/hooks/usePetitEcran'
import type { Raccourci } from '@/lib/mobile'
import type { DonneesEnseignant, SeanceEnseignant } from '@/lib/dashboard/enseignant'
import { expandPeriodLabel } from '@/lib/school-year/current-period-hint'
import { fmtDuration } from '@/lib/temps-presence/format'
import { Users, CheckCheck, PenLine } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import { Encadre, CarteCompteur, Puce, Vide, type Ton } from './tdb'

interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: any[]
  donnees: DonneesEnseignant
}

// `mobile` : meme drapeau que la barre laterale. Un raccourci vers un ecran
// masque serait offrir en tete de page ce que le menu refuse.
const RACCOURCIS: Raccourci[] = [
  { href: '/dashboard/absences', label: "Feuille d'appel", mobile: true },
  { href: '/dashboard/grades', label: 'Saisie des notes' },
  { href: '/dashboard/cahier-texte', label: 'Cahier de texte', mobile: true },
]

const STATUT: Record<SeanceEnseignant['statut'], { label: string; ton: Ton } | null> = {
  validee:   { label: 'Validée', ton: 'ok' },
  a_valider: { label: 'À valider', ton: 'attente' },
  en_cours:  { label: 'En cours', ton: 'info' },
  a_venir:   null,
  annulee:   { label: 'Annulée', ton: 'danger' },
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const jourCourt = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long' })

export default function DashboardEnseignant({ donnees: d, ...headerProps }: Props) {
  const petitEcran = usePetitEcran()
  const lien = (href: string, mobile = false) => (petitEcran && !mobile ? null : href)
  const p = d.prochaine

  const sousTitre = [
    new Date(`${d.aujourdhui}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    d.seancesDuJour ? `${pluriel(d.seancesDuJour, 'séance')} aujourd’hui` : 'aucune séance aujourd’hui',
    headerProps.periodLabel ? expandPeriodLabel(headerProps.periodLabel) : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader
        {...headerProps}
        sousTitre={sousTitre}
        actions={RACCOURCIS.filter(r => !petitEcran || r.mobile).map(r => (
          <Link key={r.href} href={r.href} className="raccourci">{r.label}</Link>
        ))}
      />

      {d.sansFiche && (
        <p role="alert" className="card encadre-tdb text-xs text-amber-800 bg-amber-50 border-amber-200">
          Aucune fiche enseignant active n’est liée à ce compte : la direction doit la rattacher.
        </p>
      )}

      {/* ── Prochaine séance + compteurs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <section className="tuile tuile-marque lg:col-span-2 !min-h-0 !p-6 justify-center" aria-label="Prochaine séance">
          <div className="tuile-anneau" aria-hidden="true" />
          {!p ? (
            <div className="relative">
              <h3 className="tuile-titre">Prochaine séance</h3>
              <p className="tuile-fort text-xl font-extrabold mt-2">Aucune séance dans les 14 prochains jours</p>
            </div>
          ) : (
            <div className="relative flex flex-wrap items-center justify-between gap-5">
              <div className="min-w-0">
                <h3 className="tuile-titre">Prochaine séance · {p.quand}</h3>
                <p className="tuile-fort text-[26px] font-extrabold mt-1.5 mb-1 leading-tight truncate">
                  {p.classe}{p.cours ? ` · ${p.cours}` : ''}
                </p>
                <p className="text-[13px]">
                  {p.debut}-{p.fin}{p.salle ? ` · ${p.salle}` : ''} · {pluriel(p.effectif, 'inscrit')}
                  {p.remplacement ? ' · remplacement' : ''}
                </p>
                {(p.devoir || p.absentsDerniereFois) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {p.devoir && <span className="etiquette-tuile">Devoir à rendre : {p.devoir}</span>}
                    {!!p.absentsDerniereFois && (
                      <span className="etiquette-tuile">{pluriel(p.absentsDerniereFois, 'absent')} la dernière fois</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link href="/dashboard/absences" className="bouton-tuile">Faire l’appel</Link>
                <Link href="/dashboard/cahier-texte" className="bouton-tuile bouton-tuile-contour">Cahier de texte</Link>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-2.5">
          <CarteCompteur icone={Users} ton="ok" label="Mes élèves" valeur={d.eleves}
 />
          <CarteCompteur icone={CheckCheck} ton="attente" label="Séances à valider · 30 jours" valeur={d.seancesAValider}
            lien={d.seancesAValider ? { href: lien('/dashboard/emploi-du-temps', true), label: 'Valider' } : undefined} />
          <CarteCompteur icone={PenLine} ton="info" label="Évaluations sans note" valeur={d.notesASaisir}
            lien={d.notesASaisir ? { href: lien('/dashboard/grades'), label: 'Saisir' } : undefined} />
        </div>
      </div>

      {/* ── Ma semaine + Mes classes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Ma semaine" lien={{ href: lien('/dashboard/emploi-du-temps', true), label: 'Emploi du temps' }} className="lg:col-span-2">
          {d.semaine.every(j => j.seances.length === 0) ? (
            <Vide>Aucune séance cette semaine.</Vide>
          ) : (
            <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.min(d.semaine.length, 4)}, minmax(0, 1fr))` }}>
              {d.semaine.map(j => (
                <div key={j.date} className={clsx('jour-tdb', j.aujourdhui && 'jour-tdb-actif')}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className={clsx('text-[11px] font-bold uppercase', j.aujourdhui ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-warm-700')}>
                      {j.aujourdhui ? 'Aujourd’hui' : jourCourt(j.date)}
                    </span>
                    <span className={clsx('text-lg font-extrabold tabular-nums', j.aujourdhui ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-warm-700')}>
                      {Number(j.date.slice(8, 10))}
                    </span>
                  </div>
                  {j.ferme ? (
                    <p className="text-[11px] text-warm-700 italic">École fermée · {j.ferme}</p>
                  ) : j.seances.length === 0 ? (
                    <p className="text-[11px] text-warm-700 italic">Pas de séance</p>
                  ) : j.seances.map(s => {
                    const st = STATUT[s.statut]
                    return (
                      <div key={s.id} className="seance-tdb">
                        <p className={clsx('font-bold text-secondary-800 truncate', s.statut === 'annulee' && 'line-through')}>
                          {s.classe}{s.cours ? ` · ${s.cours}` : ''}
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          <span className="tabular-nums text-warm-700">{s.debut}-{s.fin}</span>
                          {s.remplacement ? <Puce ton="remplacement">Rempl.</Puce> : st && <Puce ton={st.ton}>{st.label}</Puce>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </Encadre>

        <Encadre titre="Mes classes">
          {d.classes.length === 0 ? (
            <Vide>Aucune classe affectée.</Vide>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto list-scroll pr-1">
              {d.classes.map(c => (
                <div key={c.id} className="rounded-xl bg-warm-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-secondary-800 truncate">{c.name}</span>
                    <div className="flex gap-1 shrink-0">
                      {c.adulte && <Puce ton="remplacement">Adultes</Puce>}
                      <Puce ton={c.titulaire ? 'ok' : 'info'}>{c.titulaire ? 'Titulaire' : 'Remplaçant'}</Puce>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-1.5 mt-2.5">
                    <div><dd className="text-base font-extrabold tabular-nums text-secondary-800">{c.effectif}</dd><dt className="text-[10px] text-warm-700">inscrits</dt></div>
                    <div><dd className="text-base font-extrabold tabular-nums text-secondary-800">{c.assiduite === null ? '-' : `${c.assiduite.toLocaleString('fr-FR')} %`}</dd><dt className="text-[10px] text-warm-700">assiduité du mois</dt></div>
                    <div><dd className="text-base font-extrabold tabular-nums text-secondary-800">{c.moyenne === null ? '-' : c.moyenne.toLocaleString('fr-FR')}</dd><dt className="text-[10px] text-warm-700">moyenne /20</dt></div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Encadre>
      </div>

      {/* ── Devoirs · élèves à suivre · heures ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Devoirs à venir" lien={{ href: lien('/dashboard/cahier-texte', true), label: 'Cahier de texte' }}>
          {d.devoirs.length === 0 ? (
            <Vide>Aucun devoir à venir.</Vide>
          ) : d.devoirs.map(h => (
            <div key={h.id} className="ligne-tdb">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-secondary-800 truncate">{h.titre}</p>
                <p className="text-[11px] text-warm-700">{h.classe} · pour le {h.date.slice(8, 10)}/{h.date.slice(5, 7)}</p>
              </div>
              <Puce ton={h.jours <= 1 ? 'attente' : 'info'}>{h.jours === 0 ? 'Aujourd’hui' : h.jours === 1 ? 'Demain' : `${h.jours} j`}</Puce>
            </div>
          ))}
        </Encadre>

        <Encadre titre="Élèves à suivre">
          {d.aSuivre.length === 0 ? (
            <Vide>Aucun élève à signaler.</Vide>
          ) : d.aSuivre.map(e => (
            <div key={`${e.id}-${e.motif}`} className="ligne-tdb">
              <span className="grid place-items-center w-8 h-8 rounded-lg ton-info text-[11px] font-extrabold shrink-0" aria-hidden="true">
                {e.nom.split(' ').map(x => x[0]).slice(0, 2).join('')}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-secondary-800 truncate">{e.nom}</p>
                <p className="text-[11px] text-warm-700 truncate">{e.classe} · {e.motif}</p>
              </div>
              {e.nb !== null
                ? <span className="compteur ton-danger">{e.nb}</span>
                : <Puce ton="ok">Nouveau</Puce>}
            </div>
          ))}
        </Encadre>

        <Encadre titre="Mes heures du mois" lien={{ href: lien('/dashboard/temps-presence', true), label: 'Relevé' }}>
          <p className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-extrabold tabular-nums text-secondary-800 leading-none">{fmtDuration(d.heures.realiseesMin)}</span>
            {d.heures.prevuesMin > 0 && <span className="text-xs text-warm-700">sur {fmtDuration(d.heures.prevuesMin)} prévues à l’emploi du temps</span>}
          </p>
          {d.heures.prevuesMin > 0 && (
            <div className="piste-tdb !h-2 mt-2.5 mb-3">
              <div className="histo-plein h-full" style={{ width: `${Math.min(100, (d.heures.realiseesMin / d.heures.prevuesMin) * 100)}%` }} />
            </div>
          )}
          {d.heures.parType.length === 0 ? (
            <p className="text-xs text-warm-700 italic py-2">Aucune heure enregistrée ce mois-ci.</p>
          ) : d.heures.parType.map(t => (
            <div key={t.label} className="ligne-tdb text-secondary-800">
              <span className="flex-1">{t.label}</span>
              <b className="tabular-nums">{fmtDuration(t.min)}</b>
            </div>
          ))}
        </Encadre>
      </div>
    </div>
  )
}
