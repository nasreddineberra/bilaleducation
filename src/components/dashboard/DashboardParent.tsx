'use client'

import type { NotifRecente } from '@/lib/dashboard/commun'
import type { DonneesParent } from '@/lib/dashboard/parent'
import { Baby, BookOpenText, CalendarX, Bell } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import { Tuile, Encadre, Puce, Vide } from './tdb'
import { typeDevoir } from '@/components/cahier-texte/commun'
import { pluriel } from '@/lib/texte/pluriel'
import { libelleMatiere } from '@/lib/cahier-texte/matiere'

/**
 * Tableau de bord du PARENT (espace famille, lot 6) : ses enfants, les devoirs
 * a rendre dans la semaine, les absences, les notifications non lues. Lecture
 * seule ; chaque encadre mene a son ecran de l'espace famille.
 */
interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: NotifRecente[]
  stats: DonneesParent
}

const dateCourte = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export default function DashboardParent({ stats: d, ...headerProps }: Props) {
  const actifs = d.enfants.filter(e => !e.parti)

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader {...headerProps} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Tuile ton="marque" titre="Mes enfants" icone={Baby}
          valeur={actifs.length} unite={actifs.length > 1 ? 'inscrits' : 'inscrit'}
          pied={actifs.map(e => `${e.first_name} · ${e.classe_nom ?? 'sans classe'}`).join(' · ') || 'Aucun enfant inscrit cette année'}
          lien={{ href: '/dashboard/famille/enfants', label: 'Mes enfants' }} />
        <Tuile ton="ambre" titre="Devoirs" icone={BookOpenText}
          valeur={d.aRendre.length} unite="à rendre"
          pied="Dans les 7 jours, non marqués « Effectué »"
          lien={{ href: '/dashboard/famille/devoirs', label: 'Devoirs' }} />
        <Tuile ton="ardoise" titre="Absences" icone={CalendarX}
          valeur={d.absences.filter(a => a.absence_type === 'absence').length} unite="cette année"
          pied={d.nonJustifiees ? `${pluriel(d.nonJustifiees, 'non justifiée', 'non justifiées')}` : 'Toutes justifiées'}
          lien={{ href: '/dashboard/famille/absences', label: 'Absences' }} />
        <Tuile ton="encre" titre="Notifications" icone={Bell}
          valeur={headerProps.unreadNotifs} unite="non lues"
          pied="Messages de l’établissement"
          lien={{ href: '/dashboard/notifications', label: 'Notifications' }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Encadre titre="Devoirs à rendre cette semaine" lien={{ href: '/dashboard/famille/devoirs', label: 'Tous les devoirs' }}>
          {d.aRendre.length === 0 ? <Vide>Aucun devoir à rendre cette semaine.</Vide> : (
            <ul className="liste text-xs">
              {d.aRendre.slice(0, 6).map(({ devoir, enfant }) => {
                const type = typeDevoir(devoir.homework_type)
                return (
                  <li key={`${devoir.id}-${enfant.id}`} className="flex items-center gap-2 px-2 py-1.5">
                    <Puce ton={type.ton}>{type.label}</Puce>
                    <span className="font-medium text-secondary-800 truncate flex-1">{devoir.title}</span>
                    <span className="text-warm-700 shrink-0">{enfant.first_name}{libelleMatiere(devoir.subject) ? ` · ${libelleMatiere(devoir.subject)}` : ''}</span>
                    <span className="tabular-nums font-semibold text-secondary-800 shrink-0">{dateCourte(devoir.due_date)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Encadre>

        <Encadre titre="Dernières absences et retards" lien={{ href: '/dashboard/famille/absences', label: 'Toutes les absences' }}>
          {d.absences.length === 0 ? <Vide>Aucune absence cette année.</Vide> : (
            <ul className="liste text-xs">
              {d.absences.slice(0, 6).map(a => (
                <li key={a.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="tabular-nums text-secondary-800 shrink-0">{dateCourte(a.absence_date)}</span>
                  <span className="font-medium text-secondary-800 truncate flex-1">{a.prenom}</span>
                  <span className="text-warm-700 shrink-0">{a.absence_type === 'retard' ? 'Retard' : 'Absence'}</span>
                  <Puce ton={a.is_justified ? 'ok' : 'attente'}>{a.is_justified ? 'Justifiée' : 'Non justifiée'}</Puce>
                </li>
              ))}
            </ul>
          )}
        </Encadre>
      </div>
    </div>
  )
}
