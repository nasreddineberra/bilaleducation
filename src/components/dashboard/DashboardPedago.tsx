'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { usePetitEcran } from '@/hooks/usePetitEcran'
import type { Raccourci } from '@/lib/mobile'
import type { DonneesPedagogie } from '@/lib/dashboard/pedagogie'
import { expandPeriodLabel } from '@/lib/school-year/current-period-hint'
import { PenLine, FileText, CheckCheck, CalendarDays } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import TruncatedText from '@/components/ui/TruncatedText'
import { Tuile, JaugeTuile, Sparkline, Encadre, LigneATraiter, LigneSeance, Puce, Vide } from './tdb'

interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: any[]
  donnees: DonneesPedagogie
}

// `mobile` : meme drapeau que la barre laterale.
const RACCOURCIS: Raccourci[] = [
  { href: '/dashboard/evaluations', label: 'Gabarits' },
  { href: '/dashboard/grades', label: 'Saisie des notes' },
  { href: '/dashboard/bulletins', label: 'Bulletins' },
  { href: '/dashboard/emploi-du-temps', label: 'Emploi du temps', mobile: true },
]

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const jourEtDate = (d: string) =>
  new Date(`${d}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })
const lienNom = 'block font-semibold text-secondary-800 truncate hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-surface)] dark:focus-visible:ring-[var(--brand-accent)]'

export default function DashboardPedago({ donnees: d, ...headerProps }: Props) {
  const petitEcran = usePetitEcran()
  const lien = (href: string, mobile = false) => (petitEcran && !mobile ? null : href)

  const [, mm] = d.aujourdhui.split('-').map(Number)
  const nomMois = MOIS[mm - 1]
  const periode = headerProps.periodLabel ? expandPeriodLabel(headerProps.periodLabel) : 'période'

  const tenues = d.seances.filter(s => s.statut !== 'annulee')
  const nbValidees = tenues.filter(s => s.statut === 'validee').length
  const nbAValider = tenues.filter(s => s.statut === 'a_valider').length
  const nbRemplacements = tenues.filter(s => s.remplacement).length
  const nbClasses = new Set(tenues.map(s => s.classe)).size

  const n = d.saisie
  const b = d.bulletins

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
          ton="marque" titre={`Saisie des notes · ${periode}`} icone={PenLine}
          valeur={n?.taux != null ? `${n.taux} %` : '-'}
          unite={n ? `${pluriel(n.evaluations, 'évaluation')} · ${n.incompletes} incomplète${n.incompletes > 1 ? 's' : ''}` : undefined}
          pied={n ? `${n.passeesSansNote} passée${n.passeesSansNote > 1 ? 's' : ''} sans note · ${n.aVenir} à venir` : 'Aucune période en cours'}
          lien={{ href: lien('/dashboard/grades'), label: 'Saisie' }}
        >
          {n?.taux != null ? <JaugeTuile pct={n.taux} /> : null}
        </Tuile>

        <Tuile
          ton="ambre" titre={`Bulletins · ${periode}`} icone={FileText}
          valeur={b ? b.archives : '-'}
          unite={b ? `/ ${b.effectif} archivé${b.archives > 1 ? 's' : ''}` : undefined}
          pied={b
            ? `Appréciations ${b.effectif > 0 ? Math.round((b.appreciations / b.effectif) * 100) : 0} % · ${b.appreciations} / ${b.effectif}`
            : 'Aucune période en cours'}
          lien={{ href: lien('/dashboard/bulletins'), label: 'Bulletins' }}
        >
          {b && b.effectif > 0 ? <JaugeTuile pct={(b.appreciations / b.effectif) * 100} /> : null}
        </Tuile>

        <Tuile
          ton="ardoise" titre={`Assiduité · ${nomMois}`} icone={CheckCheck}
          valeur={d.assiduite ? `${d.assiduite.taux.toLocaleString('fr-FR')} %` : '-'}
          pied={d.absencesMois === null
            ? 'Comptage indisponible'
            : `${pluriel(d.absencesMois, 'absence')} · ${d.absencesMoisNonJustifiees ?? 0} non justifiée${(d.absencesMoisNonJustifiees ?? 0) > 1 ? 's' : ''}`}
          lien={{ href: lien('/dashboard/absences', true), label: 'Appel' }}
        >
          <Sparkline valeurs={d.tendance} label="Allure des absences sur 30 jours" />
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

      {/* ── Journée · Avancement · À traiter ── hauteur fixe : la page tient sans defilement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Journée en cours" className="lg:h-[268px]" lien={{ href: lien('/dashboard/emploi-du-temps', true), label: 'Emploi du temps' }}>
          {d.fermeture ? (
            <Vide>École fermée aujourd’hui · {d.fermeture}</Vide>
          ) : d.seances.length === 0 ? (
            <Vide>Aucune séance aujourd’hui.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.seances.map(s => (
                <LigneSeance key={s.id} s={s}
                  complement={s.statut === 'annulee' || s.statut === 'a_venir' ? null : s.cahier ? 'cahier renseigné' : 'cahier vide'} />
              ))}
            </div>
          )}
        </Encadre>

        <Encadre titre={`Avancement · ${periode}`} className="lg:h-[268px]" lien={{ href: lien('/dashboard/grades'), label: 'Saisie des notes' }}>
          {d.classes.length === 0 ? (
            <Vide>Aucune classe.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1 space-y-2.5">
              {d.classes.map(c => {
                const pct = c.saisie.taux ?? 0
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between gap-2 text-xs mb-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-secondary-800 shrink-0">{c.name}</span>
                        {c.adulte && <span className="shrink-0"><Puce ton="remplacement">Adultes</Puce></span>}
                        <TruncatedText text={c.professeur || 'Sans titulaire'} className="text-[11px] text-warm-700 min-w-0" />
                      </span>
                      <span className="shrink-0 tabular-nums text-warm-700">
                        {c.saisie.taux === null ? 'aucune note due' : `${c.saisie.saisies}/${c.saisie.attendues} notes`}
                        <b className="ml-2 text-secondary-800">{c.moyenne === null ? '-' : c.moyenne.toLocaleString('fr-FR')}</b>
                      </span>
                    </div>
                    <div className="piste-tdb">
                      <div className={clsx('h-full rounded-full', c.saisie.taux === null ? '' : pct === 100 ? 'bg-primary-500' : 'bg-amber-500')}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Encadre>

        <Encadre titre="À traiter" className="lg:h-[268px]">
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
            <LigneATraiter href={lien('/dashboard/emploi-du-temps', true)} label="Séances à valider · 30 jours" n={d.aTraiter.seancesAValider} ton="attente" />
            <LigneATraiter href={lien('/dashboard/grades')} label="Évaluations passées sans note" n={d.aTraiter.evaluationsSansNote} ton="info" />
            <LigneATraiter href={lien('/dashboard/grades')} label="Évaluations aux notes incomplètes" n={d.aTraiter.evaluationsIncompletes} ton="attente" />
            <LigneATraiter href={lien('/dashboard/emploi-du-temps', true)} label="Absences d’enseignant non remplacées · 7 jours" n={d.aTraiter.absencesNonRemplacees} ton="danger" />
            <LigneATraiter href={lien('/dashboard/cahier-texte', true)} label="Classes sans séance au cahier de texte · 14 jours" n={d.aTraiter.classesSansCahier} ton="orange" />
            <LigneATraiter href={lien('/dashboard/evaluations')} label="Classes sans évaluation sur la période" n={d.aTraiter.classesSansEvaluation} ton="info" />
            <LigneATraiter href={lien('/dashboard/notifications', true)} label="Notifications non lues" n={headerProps.unreadNotifs} ton="ok" />
          </div>
        </Encadre>
      </div>

      {/* ── Élèves à suivre · Évaluations · Équipe ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Élèves à suivre" className="lg:h-[236px]" lien={{ href: lien('/dashboard/students'), label: 'Apprenants' }}>
          {d.aSuivre.absences.length === 0 && d.aSuivre.moyennes.length === 0 ? (
            <Vide>Aucun élève à signaler.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.aSuivre.absences.length > 0 && <p className="stat-label mb-1">3 absences et plus · {periode}</p>}
              {d.aSuivre.absences.map(e => (
                <LigneEleve key={`a-${e.id}`} href={lien(`/dashboard/students/${e.id}`)} nom={e.nom} classe={e.classe}>
                  <span className="compteur ton-danger">{e.nb}</span>
                </LigneEleve>
              ))}
              {d.aSuivre.moyennes.length > 0 && <p className="stat-label mt-3 mb-1">Moyenne sous 8 / 20</p>}
              {d.aSuivre.moyennes.map(e => (
                <LigneEleve key={`m-${e.id}`} href={lien(`/dashboard/students/${e.id}`)} nom={e.nom} classe={e.classe}>
                  <span className="compteur ton-attente tabular-nums">{e.moyenne.toLocaleString('fr-FR')}</span>
                </LigneEleve>
              ))}
            </div>
          )}
        </Encadre>

        <Encadre titre="Évaluations · 14 jours" className="lg:h-[236px]" lien={{ href: lien('/dashboard/evaluations'), label: 'Gabarits' }}>
          {d.evaluations.length === 0 ? (
            <Vide>Aucune évaluation prévue.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.evaluations.map(e => (
                <div key={e.id} className="ligne-tdb">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary-800 truncate">{e.titre}</p>
                    <p className="text-[11px] text-warm-700 truncate">{e.classe} · {jourEtDate(e.date)}</p>
                  </div>
                  <Puce ton="info">{e.jours === 1 ? 'Demain' : `${e.jours} j`}</Puce>
                </div>
              ))}
            </div>
          )}
        </Encadre>

        <Encadre titre="Équipe · 7 jours" className="lg:h-[236px]" lien={{ href: lien('/dashboard/temps-presence', true), label: 'Temps de présence' }}>
          {d.equipe.length === 0 ? (
            <Vide>Aucune absence d’enseignant prévue.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.equipe.map(e => (
                <div key={e.cle} className="ligne-tdb">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary-800 truncate">{e.enseignant || 'Enseignant'}</p>
                    <p className="text-[11px] text-warm-700 truncate">
                      {jourEtDate(e.date)} · {e.classes}{e.remplacant ? ` · remplacement : ${e.remplacant}` : ''}
                    </p>
                  </div>
                  {e.statut === 'remplacee'
                    ? <Puce ton="ok">Remplacement assuré</Puce>
                    : <Puce ton="danger">À remplacer</Puce>}
                </div>
              ))}
            </div>
          )}
        </Encadre>
      </div>
    </div>
  )
}

function LigneEleve({ href, nom, classe, children }: { href: string | null; nom: string; classe: string; children: React.ReactNode }) {
  return (
    <div className="ligne-tdb">
      <div className="flex-1 min-w-0">
        {href ? <Link href={href} className={lienNom}>{nom}</Link> : <p className="font-semibold text-secondary-800 truncate">{nom}</p>}
      </div>
      <span className="text-warm-700 shrink-0">{classe}</span>
      {children}
    </div>
  )
}
