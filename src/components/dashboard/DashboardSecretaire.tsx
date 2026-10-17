'use client'

import Link from 'next/link'
import { usePetitEcran } from '@/hooks/usePetitEcran'
import type { Raccourci } from '@/lib/mobile'
import type { DonneesSecretaire } from '@/lib/dashboard/secretaire'
import { expandPeriodLabel } from '@/lib/school-year/current-period-hint'
import { Users, UserX, FileWarning, CalendarX } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import { Tuile, JaugeTuile, Encadre, LigneATraiter, LigneSeance, RemplissageClasses, Puce, Vide } from './tdb'

interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: any[]
  donnees: DonneesSecretaire
}

// `mobile` : meme drapeau que la barre laterale.
const RACCOURCIS: Raccourci[] = [
  { href: '/dashboard/students/new', label: 'Nouvel apprenant' },
  { href: '/dashboard/affectation', label: 'Affectations' },
  { href: '/dashboard/absences', label: "Feuilles d'appel", mobile: true },
  { href: '/dashboard/parents', label: 'Parents' },
]

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`
const dateCourte = (d: string) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '')
const lienNom = 'block font-semibold text-secondary-800 truncate hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-surface)] dark:focus-visible:ring-[var(--brand-accent)]'

export default function DashboardSecretaire({ donnees: d, ...headerProps }: Props) {
  const petitEcran = usePetitEcran()
  const lien = (href: string, mobile = false) => (petitEcran && !mobile ? null : href)

  const tenues = d.seances.filter(s => s.statut !== 'annulee')
  const absents = d.absentsDuJour.filter(a => !a.retard)
  const absentsNonJustifies = absents.filter(a => !a.justifiee).length
  const retards = d.absentsDuJour.length - absents.length
  const sansClasse = d.sansClasse?.length ?? null
  const a30 = d.absences30j

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader
        {...headerProps}
        masquerNotifs
        sousTitre={[
          new Date(`${d.aujourdhui}T12:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
          headerProps.periodLabel ? expandPeriodLabel(headerProps.periodLabel) : null,
          d.fermeture ? `école fermée (${d.fermeture})` : tenues.length ? `${pluriel(tenues.length, 'séance')} aujourd’hui` : null,
        ].filter(Boolean).join(' · ')}
        actions={RACCOURCIS.filter(r => !petitEcran || r.mobile).map(r => (
          <Link key={r.href} href={r.href} className="raccourci">{r.label}</Link>
        ))}
      />

      {/* ── 4 tuiles ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Tuile
          ton="marque" titre="Apprenants" icone={Users}
          valeur={d.inscrits?.total ?? '-'}
          unite={d.foyers !== null ? `actifs · ${pluriel(d.foyers, 'foyer')}` : 'actifs'}
          pied={d.inscrits
            ? `${pluriel(d.inscrits.eleves, 'élève')} · ${pluriel(d.inscrits.adultes, 'adulte')}${d.nouveauxCeMois ? ` · +${d.nouveauxCeMois} ce mois` : ''}`
            : 'Comptage indisponible'}
          lien={{ href: lien('/dashboard/students'), label: 'Apprenants' }}
        >
          {d.inscrits && d.inscrits.total > 0 && (
            <div className="flex gap-1" role="presentation">
              <div className="h-1.5 rounded-full" style={{ flex: d.inscrits.eleves, background: 'var(--tuile-jauge)' }} />
              <div className="h-1.5 rounded-full" style={{ flex: d.inscrits.adultes, background: 'var(--tuile-piste)' }} />
            </div>
          )}
        </Tuile>

        <Tuile
          ton="ambre" titre="Sans classe" icone={UserX}
          valeur={sansClasse ?? '-'}
          unite={sansClasse === null ? undefined : `élève${sansClasse > 1 ? 's' : ''} à affecter`}
          pied={sansClasse === null || d.elevesActifs === null
            ? 'Comptage indisponible'
            : `${d.elevesActifs - sansClasse} affecté${d.elevesActifs - sansClasse > 1 ? 's' : ''} sur ${d.elevesActifs}`}
          lien={{ href: lien('/dashboard/affectation'), label: 'Affecter' }}
        >
          {sansClasse !== null && d.elevesActifs ? <JaugeTuile pct={((d.elevesActifs - sansClasse) / d.elevesActifs) * 100} /> : null}
        </Tuile>

        <Tuile
          ton="ardoise" titre="Absences · 30 jours" icone={FileWarning}
          valeur={a30 ? a30.nonJustifiees : '-'}
          unite={a30 ? 'sans justificatif' : undefined}
          pied={a30 ? `${pluriel(a30.total, 'absence')} · ${a30.total - a30.nonJustifiees} justifiée${a30.total - a30.nonJustifiees > 1 ? 's' : ''}` : 'Comptage indisponible'}
          lien={{ href: lien('/dashboard/absences', true), label: 'Appel' }}
        >
          {a30 && a30.total > 0 && (
            <div className="flex gap-1" role="presentation">
              <div className="h-1.5 rounded-full" style={{ flex: a30.total - a30.nonJustifiees, background: 'var(--tuile-jauge)' }} />
              <div className="h-1.5 rounded-full" style={{ flex: a30.nonJustifiees, background: 'var(--tuile-ambre)' }} />
            </div>
          )}
        </Tuile>

        <Tuile
          ton="encre" titre="Absents aujourd'hui" icone={CalendarX}
          valeur={d.fermeture ? '-' : absents.length}
          unite={d.fermeture ? 'école fermée' : `· ${pluriel(tenues.length, 'séance')}`}
          pied={d.fermeture
            ? d.fermeture
            : `${absentsNonJustifies} non justifié${absentsNonJustifies > 1 ? 's' : ''} · ${pluriel(retards, 'retard')}`}
          lien={{ href: lien('/dashboard/absences', true), label: 'Feuilles' }}
        />
      </div>

      {/* ── Journée · À traiter ── hauteur fixe : la page tient sans defilement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Journée en cours" className="lg:col-span-2 lg:h-[268px]" lien={{ href: lien('/dashboard/absences', true), label: "Feuilles d'appel" }}>
          {d.fermeture ? (
            <Vide>École fermée aujourd’hui · {d.fermeture}</Vide>
          ) : d.seances.length === 0 ? (
            <Vide>Aucune séance aujourd’hui.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.seances.map(s => (
                <LigneSeance key={s.id} s={s}
                  complement={s.statut === 'annulee' || s.statut === 'a_venir' ? null : s.absents ? `${pluriel(s.absents, 'absent')} saisi${s.absents > 1 ? 's' : ''}` : 'aucun absent saisi'} />
              ))}
            </div>
          )}
        </Encadre>

        <Encadre titre="À traiter" className="lg:h-[268px]">
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
            <LigneATraiter href={lien('/dashboard/affectation')} label="Élèves sans classe" n={sansClasse} ton="orange" />
            <LigneATraiter href={lien('/dashboard/absences', true)} label="Absences sans justificatif · 30 jours" n={a30 ? a30.nonJustifiees : null} ton="danger" />
            {/* Masquee tant qu'aucun document n'est declare obligatoire : un
                « 0 » laisserait croire que les dossiers sont complets. */}
            {d.aTraiter.fichesIncompletes !== null && (
              <LigneATraiter href={lien('/dashboard/students')} label="Fiches sans tous les documents requis" n={d.aTraiter.fichesIncompletes} ton="info" />
            )}
            <LigneATraiter href={lien('/dashboard/teachers')} label="Enseignants sans compte de connexion" n={d.aTraiter.enseignantsSansCompte} ton="info" />
            <LigneATraiter href={lien('/dashboard/notifications', true)} label="Notifications non lues" n={headerProps.unreadNotifs} ton="ok" />
          </div>
        </Encadre>
      </div>

      {/* ── Derniers inscrits · Remplissage · Absents ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
        <Encadre titre="Derniers inscrits" className="lg:h-[236px]" lien={{ href: lien('/dashboard/students'), label: 'Apprenants' }}>
          {d.derniersInscrits.length === 0 ? (
            <Vide>Aucune inscription.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.derniersInscrits.map(r => {
                const href = r.id ? lien(`/dashboard/students/${r.id}`) : null
                return (
                  <div key={r.cle} className="ligne-tdb">
                    <div className="flex-1 min-w-0">
                      {href ? <Link href={href} className={lienNom}>{r.nom}</Link> : <p className="font-semibold text-secondary-800 truncate">{r.nom}</p>}
                      <p className="text-[11px] text-warm-700 truncate tabular-nums">{[r.adulte ? 'Adulte' : r.numero, dateCourte(r.date)].filter(Boolean).join(' · ')}</p>
                    </div>
                    {r.classe
                      ? <Puce ton={r.adulte ? 'remplacement' : 'info'}>{r.classe}</Puce>
                      : <Puce ton="attente">Sans classe</Puce>}
                  </div>
                )
              })}
            </div>
          )}
        </Encadre>

        <Encadre titre="Remplissage des classes" className="lg:h-[236px]" lien={{ href: lien('/dashboard/classes'), label: 'Classes' }}>
          <RemplissageClasses classes={d.classes} />
        </Encadre>

        <Encadre titre="Absents aujourd'hui" className="lg:h-[236px]" lien={{ href: lien('/dashboard/absences', true), label: 'Appel' }}>
          {d.absentsDuJour.length === 0 ? (
            <Vide>Aucune absence saisie aujourd’hui.</Vide>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto list-scroll pr-1">
              {d.absentsDuJour.map(a => {
                const href = lien(`/dashboard/students/${a.id}`)
                return (
                  <div key={`${a.id}-${a.classe}`} className="ligne-tdb">
                    <div className="flex-1 min-w-0">
                      {href ? <Link href={href} className={lienNom}>{a.nom}</Link> : <p className="font-semibold text-secondary-800 truncate">{a.nom}</p>}
                      <p className="text-[11px] text-warm-700 truncate">
                        {a.classe}{!a.retard && a.nbPeriode >= 3 ? ` · ${a.nbPeriode}e absence de la période` : ''}
                      </p>
                    </div>
                    {a.retard
                      ? <Puce ton="attente">Retard</Puce>
                      : a.justifiee ? <Puce ton="ok">Justifiée</Puce> : <Puce ton="danger">Non justifiée</Puce>}
                  </div>
                )
              })}
            </div>
          )}
        </Encadre>
      </div>
    </div>
  )
}
