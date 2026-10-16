'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { usePetitEcran } from '@/hooks/usePetitEcran'
import type { Raccourci } from '@/lib/mobile'
import type { DonneesDirection, SeanceAffichee } from '@/lib/dashboard/direction'
import type { StatutSeance } from '@/lib/dashboard/seances'
import { expandPeriodLabel } from '@/lib/school-year/current-period-hint'
import {
  ResponsiveContainer, Tooltip as RTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Users, Wallet, CheckCheck, CalendarDays, AlertTriangle } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import TruncatedText from '@/components/ui/TruncatedText'
import { Tuile, JaugeTuile, Sparkline, Encadre, LigneATraiter, Puce, Vide, type Ton } from './tdb'
import { SERIES, INK, STATUS_COLOR, VizTooltip, VizLegend, fmtEur } from './viz'

interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: any[]
  donnees: DonneesDirection
  /** Rappel de bascule de période, ou null s'il n'y a rien à signaler. */
  periodHint: { message: string; missing: boolean } | null
}

// `mobile` : meme drapeau que la barre laterale. Les ecrans masques sur
// telephone ne sont pas proposes en raccourci.
const RACCOURCIS: Raccourci[] = [
  { href: '/dashboard/students/new', label: 'Nouvel élève' },
  { href: '/dashboard/communications/new', label: 'Nouveau message' },
  { href: '/dashboard/grades', label: 'Saisie des notes' },
  { href: '/dashboard/absences', label: "Feuille d'appel", mobile: true },
]

const STATUT: Record<StatutSeance, { label: string; ton: Ton; barre: string }> = {
  validee:   { label: 'Validée',   ton: 'ok',      barre: 'bg-primary-500' },
  a_valider: { label: 'À valider', ton: 'attente', barre: 'bg-amber-500' },
  en_cours:  { label: 'En cours',  ton: 'info',    barre: 'bg-secondary-500' },
  a_venir:   { label: 'À venir',   ton: 'neutre',  barre: 'bg-warm-300' },
  annulee:   { label: 'Annulée',   ton: 'danger',  barre: 'bg-red-500' },
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

export default function DashboardAdmin({ donnees: d, periodHint, ...headerProps }: Props) {
  const petitEcran = usePetitEcran()
  // Lien neutralise sur telephone quand l'ecran de destination y est masque.
  const lien = (href: string, mobile = false) => (petitEcran && !mobile ? null : href)

  const [, mm] = d.aujourdhui.split('-').map(Number)
  const nomMois = MOIS[mm - 1]

  // ── Tuile « Aujourd'hui » ──
  const tenues = d.seances.filter(s => s.statut !== 'annulee')
  const nbValidees = tenues.filter(s => s.statut === 'validee').length
  const nbAValider = tenues.filter(s => s.statut === 'a_valider').length
  const nbRemplacements = tenues.filter(s => s.remplacement).length
  const nbClasses = new Set(tenues.map(s => s.classe)).size

  const f = d.finances
  const maxMensuel = Math.max(1, ...(f?.mensuel ?? []).map(m => Math.max(m.attendu, m.encaisse)))

  const trendHasData = d.tendance.some(t => t.justified > 0 || t.unjustified > 0)

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader
        {...headerProps}
        masquerNotifs
        sousTitre={[
          new Date(`${d.aujourdhui}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
          headerProps.periodLabel ? expandPeriodLabel(headerProps.periodLabel) : null,
          d.fermeture ? `école fermée (${d.fermeture})` : null,
        ].filter(Boolean).join(' · ')}
        actions={RACCOURCIS.filter(r => !petitEcran || r.mobile).map(r => (
          <Link key={r.href} href={r.href} className="raccourci">{r.label}</Link>
        ))}
      />

      {/* ── 4 tuiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Tuile
          ton="marque" titre="Inscrits" icone={Users}
          valeur={d.inscrits?.total ?? '-'}
          unite={d.limite ? `/ ${d.limite} de l'abonnement` : undefined}
          pied={d.inscrits
            ? `${pluriel(d.inscrits.eleves, 'élève')} · ${pluriel(d.inscrits.adultes, 'adulte')}${d.nouveauxCeMois ? ` · +${d.nouveauxCeMois} ce mois` : ''}`
            : 'Comptage indisponible'}
          lien={{ href: lien('/dashboard/students'), label: 'Apprenants' }}
        >
          {d.limite && d.inscrits ? <JaugeTuile pct={(d.inscrits.total / d.limite) * 100} /> : null}
        </Tuile>

        <Tuile
          ton="ambre" titre="Recouvrement" icone={Wallet}
          valeur={f ? `${f.rate} %` : '-'}
          unite={f ? 'encaissé' : undefined}
          pied={f ? `${fmtEur(f.collected)} sur ${fmtEur(f.billed)}` : 'Aucune année en cours'}
          lien={{ href: lien('/dashboard/financements/reglements'), label: 'Règlements' }}
        >
          {f ? <JaugeTuile pct={f.rate} /> : null}
        </Tuile>

        <Tuile
          ton="ardoise" titre={`Assiduité · ${nomMois}`} icone={CheckCheck}
          valeur={d.assiduite ? `${d.assiduite.taux.toLocaleString('fr-FR')} %` : '-'}
          pied={d.absencesMois === null
            ? 'Comptage indisponible'
            : `${pluriel(d.absencesMois, 'absence')} · ${d.absencesMoisNonJustifiees ?? 0} non justifiée${(d.absencesMoisNonJustifiees ?? 0) > 1 ? 's' : ''}`}
          lien={{ href: lien('/dashboard/absences', true), label: 'Appel' }}
        >
          <Sparkline
            valeurs={d.tendance.map(t => t.justified + t.unjustified)}
            label="Allure des absences sur 30 jours"
          />
        </Tuile>

        <Tuile
          ton="encre" titre="Aujourd'hui" icone={CalendarDays}
          valeur={d.fermeture ? '-' : tenues.length}
          unite={d.fermeture ? 'école fermée' : `séance${tenues.length > 1 ? 's' : ''} · ${pluriel(nbClasses, 'classe')}`}
          pied={d.fermeture
            ? d.fermeture
            : tenues.length === 0
              ? 'Aucune séance aujourd’hui'
              : `${nbValidees} validée${nbValidees > 1 ? 's' : ''} · ${nbAValider} à valider${nbRemplacements ? ` · ${pluriel(nbRemplacements, 'remplacement')}` : ''}`}
          lien={{ href: lien('/dashboard/emploi-du-temps', true), label: 'EDT' }}
        >
          {tenues.length > 0 && (
            <div className="flex gap-1" role="presentation">
              {tenues.map(s => (
                <div key={s.id} className="h-1.5 flex-1 rounded-full" style={{
                  background: s.statut === 'validee' ? 'var(--tuile-jauge)' : s.statut === 'a_valider' ? 'var(--tuile-ambre)' : 'var(--tuile-piste)',
                }} />
              ))}
            </div>
          )}
        </Tuile>
      </div>

      {/* ── Journée · Remplissage · À traiter ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Journée en cours" lien={{ href: lien('/dashboard/emploi-du-temps', true), label: 'Emploi du temps' }}>
          {d.fermeture ? (
            <Vide>École fermée aujourd’hui · {d.fermeture}</Vide>
          ) : d.seances.length === 0 ? (
            <Vide>Aucune séance aujourd’hui.</Vide>
          ) : (
            <div className="max-h-[248px] overflow-y-auto list-scroll pr-1">
              {d.seances.map(s => <LigneSeance key={s.id} s={s} />)}
            </div>
          )}
        </Encadre>

        <Encadre titre="Remplissage des classes" lien={{ href: lien('/dashboard/classes'), label: 'Classes' }}>
          {d.classes.length === 0 ? (
            <Vide>Aucune classe.</Vide>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto list-scroll pr-1">
              {d.classes.map(c => {
                const pct = c.max > 0 ? Math.round((c.enrolled / c.max) * 100) : 0
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-secondary-800 shrink-0">{c.name}</span>
                        {c.adulte && <span className="shrink-0"><Puce ton="remplacement">Adultes</Puce></span>}
                        {(c.professeur || c.seance) && (
                          <TruncatedText
                            text={[c.professeur || 'Sans titulaire', c.seance].filter(Boolean).join(' · ')}
                            className="text-[11px] text-warm-700 min-w-0"
                          />
                        )}
                      </span>
                      <span className="text-warm-700 tabular-nums shrink-0">{c.enrolled} / {c.max}</span>
                    </div>
                    <div className="piste-tdb">
                      <div className={clsx('h-full rounded-full', pct >= 100 ? 'bg-red-500' : pct >= 85 ? 'bg-orange-500' : 'bg-primary-500')}
                        style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Encadre>

        <Encadre titre="À traiter">
          {periodHint && (() => {
            const contenu = (
              <>
                <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                <span className="font-semibold">{periodHint.message}</span>
              </>
            )
            const base = 'flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs mb-2'
            return lien('/dashboard/annee-scolaire')
              ? <Link href="/dashboard/annee-scolaire" className={clsx(base, 'hover:bg-amber-100 transition-colors')}>{contenu}</Link>
              : <div className={base}>{contenu}</div>
          })()}
          <div>
            <LigneATraiter href={lien('/dashboard/financements/reglements')} label="Familles sans aucun paiement" n={d.aTraiter.famillesSansPaiement} ton="orange" />
            <LigneATraiter href={lien('/dashboard/absences', true)} label="Absences non justifiées" n={d.aTraiter.absencesNonJustifiees} ton="danger" />
            <LigneATraiter href={lien('/dashboard/emploi-du-temps', true)} label="Séances à valider · 30 jours" n={d.aTraiter.seancesAValider} ton="attente" />
            <LigneATraiter href={lien('/dashboard/grades')} label="Évaluations passées sans note" n={d.aTraiter.evaluationsSansNote} ton="info" />
            {/* Masquee tant qu'aucun document n'est declare obligatoire : un
                « 0 » laisserait croire que les dossiers sont complets. */}
            {d.aTraiter.fichesIncompletes !== null && (
              <LigneATraiter href={lien('/dashboard/students')} label="Fiches sans tous les documents requis" n={d.aTraiter.fichesIncompletes} ton="info" />
            )}
            <LigneATraiter href={lien('/dashboard/notifications', true)} label="Notifications non lues" n={headerProps.unreadNotifs} ton="ok" />
          </div>
        </Encadre>
      </div>

      {/* ── Encaissements · Absences · Familles ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre
          titre="Encaissements par mois"
          lien={{ href: lien('/dashboard/financements/vue-globale'), label: 'Statistiques' }}
        >
          {!f || f.mensuel.length === 0 ? (
            <Vide>Aucune facturation.</Vide>
          ) : (
            <>
            <div className="flex items-end gap-1 h-[172px]" role="img"
              aria-label={`Encaissements par mois : ${f.mensuel.map(m => `${m.label} ${fmtEur(m.encaisse)}`).join(', ')}`}>
              {f.mensuel.map(m => {
                const haut = Math.max(m.attendu, m.encaisse)
                return (
                  <div key={m.key} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5">
                    <span className="text-[9px] text-warm-700 tabular-nums whitespace-nowrap">
                      {m.encaisse > 0 ? `${(m.encaisse / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k` : ''}
                    </span>
                    <div className="histo-barre" style={{ height: `${Math.max(4, (haut / maxMensuel) * 128)}px` }}>
                      <div className="histo-plein" style={{ height: haut > 0 ? `${(m.encaisse / haut) * 100}%` : 0 }} />
                    </div>
                    <span className="text-[10px] font-semibold text-warm-700">{m.label}</span>
                  </div>
                )
              })}
            </div>
            <VizLegend items={[{ label: 'Encaissé', color: SERIES.primary }, { label: 'Échéances prévues', color: 'var(--jauge-fond)' }]} />
            </>
          )}
        </Encadre>

        <Encadre titre="Absences · 30 jours" lien={{ href: lien('/dashboard/absences', true), label: 'Appel' }}>
          <div className="h-[130px] min-w-0">
            {!trendHasData ? (
              <p className="text-xs text-warm-700 italic grid place-items-center h-full">Aucune absence sur la période.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.tendance} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid vertical={false} stroke={INK.grid} />
                  <XAxis dataKey="label" tick={{ fill: INK.muted, fontSize: 9 }} axisLine={{ stroke: INK.axis }} tickLine={false} interval={6} />
                  <YAxis allowDecimals={false} tick={{ fill: INK.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <RTooltip content={<VizTooltip unit="absence" />} cursor={{ stroke: INK.axis }} />
                  <Line type="monotone" dataKey="unjustified" name="Non justifiées" stroke={SERIES.orange} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="justified" name="Justifiées" stroke={SERIES.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {trendHasData && (
            <VizLegend items={[{ label: 'Non justifiées', color: SERIES.orange }, { label: 'Justifiées', color: SERIES.primary }]} />
          )}
          <p className="stat-label mt-3 mb-1">À surveiller · 3 absences et plus{headerProps.periodLabel ? ` · ${expandPeriodLabel(headerProps.periodLabel)}` : ''}</p>
          {d.aSurveiller.length === 0 ? (
            <p className="text-xs text-warm-700 italic py-1">Aucun apprenant.</p>
          ) : d.aSurveiller.map(e => (
            <div key={e.id} className="ligne-tdb">
              {lien(`/dashboard/students/${e.id}`) ? (
                <Link href={`/dashboard/students/${e.id}`} className="flex-1 font-semibold text-secondary-800 truncate hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-surface)] dark:focus-visible:ring-[var(--brand-accent)]">{e.nom}</Link>
              ) : (
                <span className="flex-1 font-semibold text-secondary-800 truncate">{e.nom}</span>
              )}
              <span className="text-warm-700">{e.classe}</span>
              <span className="compteur ton-danger">{e.nb}</span>
            </div>
          ))}
        </Encadre>

        <Encadre titre={f ? `Familles · ${pluriel(f.familles, 'dossier')}` : 'Familles'} lien={{ href: lien('/dashboard/financements/reglements'), label: 'Détail' }}>
          {!f || f.familles === 0 ? (
            <Vide>Aucun dossier.</Vide>
          ) : (
            <>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3 mt-1" role="presentation">
                {([['paid', f.counts.paid], ['partial', f.counts.partial], ['pending', f.counts.pending], ['overpaid', f.counts.overpaid]] as const)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => <div key={k} style={{ flex: n, background: STATUS_COLOR[k] }} />)}
              </div>
              {([
                ['paid', 'Soldées', f.counts.paid],
                ['partial', 'Paiement partiel', f.counts.partial],
                ['pending', 'Aucun versement', f.counts.pending],
                ['overpaid', 'Trop perçu', f.counts.overpaid],
              ] as const).filter(([k, , n]) => k !== 'overpaid' || n > 0).map(([k, label, n]) => (
                <div key={k} className="ligne-tdb text-secondary-800">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_COLOR[k] }} aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <b className="tabular-nums">{n}</b>
                </div>
              ))}
              <div className="mt-auto pt-3">
                <div className="flex justify-between items-center rounded-lg bg-warm-50 px-3 py-2 text-xs">
                  <span className="text-warm-700">Reste dû sur les échéances de {nomMois}</span>
                  <b className="tabular-nums text-secondary-800">{fmtEur(f.echeancesDuMois)}</b>
                </div>
              </div>
            </>
          )}
        </Encadre>
      </div>
    </div>
  )
}

function LigneSeance({ s }: { s: SeanceAffichee }) {
  const st = STATUT[s.statut]
  return (
    <div className="ligne-tdb">
      <span className="w-[86px] shrink-0 tabular-nums font-semibold text-warm-700">{s.debut}-{s.fin}</span>
      <span className={clsx('w-1 h-7 rounded-full shrink-0', s.remplacement ? 'bg-violet-500' : st.barre)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={clsx('font-semibold text-secondary-800 truncate', s.statut === 'annulee' && 'line-through')}>
          {s.classe}{s.cours ? ` · ${s.cours}` : ''}
        </p>
        <p className="text-[11px] text-warm-700 truncate">
          {s.enseignant || 'Sans enseignant'}{s.titulaire ? `, remplace ${s.titulaire}` : ''}
        </p>
      </div>
      <span className="hidden 2xl:inline w-20 shrink-0 text-right text-warm-700 tabular-nums">{pluriel(s.effectif, 'inscrit')}</span>
      <div className="flex gap-1 shrink-0">
        {s.remplacement && <Puce ton="remplacement">Remplacement</Puce>}
        <Puce ton={st.ton}>{st.label}</Puce>
      </div>
    </div>
  )
}
