import Link from 'next/link'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { Cliquable } from '@/components/ui/Cliquable'
import TruncatedText from '@/components/ui/TruncatedText'
import type { SeanceAffichee } from '@/lib/dashboard/direction'
import type { StatutSeance } from '@/lib/dashboard/seances'

/**
 * Briques du tableau de bord (refonte du 16/10). Les couleurs vivent dans les
 * classes `.tuile-*`, `.ton-*`, `.encadre-tdb` de `globals.css`, adossees a
 * des jetons : aucune teinte ecrite ici.
 */

export type TonTuile = 'marque' | 'ambre' | 'ardoise' | 'encre'
export type Ton = 'ok' | 'attente' | 'info' | 'remplacement' | 'danger' | 'orange' | 'neutre'

/** Tuile en couleur pleine : titre, icone, chiffre, visuel libre, pied. */
export function Tuile({ ton, titre, icone: Icone, valeur, unite, children, pied, lien }: {
  ton: TonTuile
  titre: string
  icone: LucideIcon
  valeur: React.ReactNode
  unite?: string
  children?: React.ReactNode
  pied: React.ReactNode
  /** `href: null` = lien neutralise (ecran masque sur telephone). */
  lien?: { href: string | null; label: string }
}) {
  return (
    <section className={clsx('tuile', `tuile-${ton}`)} aria-label={titre}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="tuile-titre">{titre}</h3>
        <span className="tuile-icone" aria-hidden="true"><Icone size={18} strokeWidth={2} /></span>
      </div>
      <p className="leading-none">
        <span className="tuile-fort text-[28px] font-extrabold tabular-nums tracking-tight">{valeur}</span>
        {unite && <span className="text-xs ml-1.5">{unite}</span>}
      </p>
      {children}
      <div className="mt-auto flex items-center justify-between gap-2 text-[11px] font-medium">
        <span className="min-w-0 truncate">{pied}</span>
        {lien?.href && (
          <Link href={lien.href} className="tuile-lien shrink-0">{lien.label}</Link>
        )}
      </div>
    </section>
  )
}

/** Jauge de tuile (0 a 100). */
export function JaugeTuile({ pct }: { pct: number }) {
  return (
    <div className="tuile-piste" role="presentation">
      <div className="tuile-jauge" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

/** Mini-courbe en couleur du texte de la tuile (aucune echelle : une allure). */
export function Sparkline({ valeurs, label }: { valeurs: number[]; label: string }) {
  if (valeurs.length < 2) return null
  const max = Math.max(1, ...valeurs)
  const pts = valeurs
    .map((v, i) => `${(i / (valeurs.length - 1)) * 200},${26 - (v / max) * 22}`)
    .join(' ')
  return (
    <svg viewBox="0 0 200 28" width="100%" height="26" preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Encadre blanc : titre, lien a droite, contenu. */
export function Encadre({ titre, lien, aside, className, children }: {
  titre: string
  lien?: { href: string | null; label: string }
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={clsx('card encadre-tdb flex flex-col', className)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[13px] font-bold text-secondary-800">{titre}</h3>
        {aside}
        {lien?.href && <Link href={lien.href} className="lien-tdb shrink-0">{lien.label}</Link>}
      </div>
      {children}
    </section>
  )
}

/** Ligne « A traiter » : compteur colore si non nul, libelle, chevron si lien. */
export function LigneATraiter({ href, label, n, ton }: {
  href: string | null
  label: string
  /** `null` = comptage impossible : « - », jamais un faux zero. */
  n: number | null
  ton: Ton
}) {
  return (
    <Cliquable
      href={href}
      className="ligne-tdb text-secondary-800"
      classNameLien="rounded-md hover:bg-warm-50 -mx-2 px-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-surface)] dark:focus-visible:ring-[var(--brand-accent)]"
    >
      <span className={clsx('compteur', n ? `ton-${ton}` : 'ton-neutre')}>{n ?? '-'}</span>
      <span className="flex-1 font-medium">{label}</span>
      {href && <ChevronRight size={14} className="text-warm-700 shrink-0" aria-hidden="true" />}
    </Cliquable>
  )
}

/**
 * Alerte des absences d'enseignant (lot 3, decision du 28/10) : de la saisie de
 * l'absence a son dernier jour. Le compteur dit combien d'absences sont en cours
 * ou a venir ; en ambre, avec le nombre de seances, tant qu'il en reste a decider.
 */
export function LigneAbsencesEnseignants({ href, alerte }: {
  href: string | null
  alerte: { nbAbsences: number; nbADecider: number } | null
}) {
  const aDecider = alerte?.nbADecider ?? 0
  return (
    <LigneATraiter
      href={href}
      label={aDecider > 0
        ? `Absences d’enseignant · ${aDecider} ${aDecider > 1 ? 'séances' : 'séance'} à décider`
        : 'Absences d’enseignant en cours ou à venir'}
      n={alerte ? alerte.nbAbsences : null}
      ton={aDecider > 0 ? 'attente' : 'neutre'}
    />
  )
}

/** Compteur en carte blanche : icone teintee, libelle, chiffre, action. */
export function CarteCompteur({ icone: Icone, ton, label, valeur, lien }: {
  icone: LucideIcon
  ton: Ton
  label: string
  valeur: React.ReactNode
  lien?: { href: string | null; label: string }
}) {
  return (
    <section className="card encadre-tdb flex items-center gap-3 !py-3" aria-label={label}>
      <span className={clsx('grid place-items-center w-10 h-10 rounded-xl shrink-0', `ton-${ton}`)} aria-hidden="true">
        <Icone size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="stat-label">{label}</p>
        <p className="text-xl font-extrabold tabular-nums text-secondary-800 leading-tight">{valeur}</p>
      </div>
      {lien?.href && <Link href={lien.href} className="lien-tdb shrink-0">{lien.label}</Link>}
    </section>
  )
}

export function Puce({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return <span className={clsx('puce', `ton-${ton}`)}>{children}</span>
}

export function Vide({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-warm-700 italic py-6 text-center">{children}</p>
}

export const STATUT_SEANCE: Record<StatutSeance, { label: string; ton: Ton; barre: string }> = {
  validee:   { label: 'Validée',   ton: 'ok',      barre: 'bg-primary-500' },
  a_valider: { label: 'À valider', ton: 'attente', barre: 'bg-amber-500' },
  en_cours:  { label: 'En cours',  ton: 'info',    barre: 'bg-secondary-500' },
  a_venir:   { label: 'À venir',   ton: 'neutre',  barre: 'bg-warm-300' },
  annulee:   { label: 'Annulée',   ton: 'danger',  barre: 'bg-red-500' },
}

/** Ligne d'une seance de la journee (Direction, Responsable pedagogique).
 *  `complement` : precision ajoutee sous la classe (ex. etat du cahier de texte). */
export function LigneSeance({ s, complement }: { s: SeanceAffichee; complement?: string | null }) {
  const st = STATUT_SEANCE[s.statut]
  return (
    <div className="ligne-tdb">
      <span className="w-[86px] shrink-0 tabular-nums font-semibold text-warm-700">{s.debut}-{s.fin}</span>
      <span className={clsx('w-1 h-7 rounded-full shrink-0', s.remplacement ? 'bg-violet-500' : st.barre)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className={clsx('font-semibold text-secondary-800 truncate', s.statut === 'annulee' && 'line-through')}>
          {s.classe}{s.cours ? ` · ${s.cours}` : ''}
        </p>
        <p className="text-[11px] text-warm-700 truncate">
          {s.enseignant || 'Sans enseignant'}{s.titulaire ? `, remplace ${s.titulaire}` : ''}{complement ? ` · ${complement}` : ''}
        </p>
      </div>
      <span className="hidden 2xl:inline w-20 shrink-0 text-right text-warm-700 tabular-nums">{s.effectif} inscrit{s.effectif > 1 ? 's' : ''}</span>
      <div className="flex gap-1 shrink-0">
        {s.remplacement && <Puce ton="remplacement">Remplacement</Puce>}
        <Puce ton={st.ton}>{st.label}</Puce>
      </div>
    </div>
  )
}

export interface ClasseRemplissage {
  name: string
  enrolled: number
  max: number
  adulte: boolean
  professeur: string
  seance: string
}

/** Remplissage des classes : inscrits / capacite, titulaire et seance (Direction, Secretaire). */
export function RemplissageClasses({ classes }: { classes: ClasseRemplissage[] }) {
  return (
    <>
    {classes.length === 0 ? (
      <Vide>Aucune classe.</Vide>
    ) : (
      <div className="space-y-2.5 flex-1 min-h-0 max-h-[260px] overflow-y-auto list-scroll pr-1">
        {classes.map(c => {
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
    </>
  )
}
