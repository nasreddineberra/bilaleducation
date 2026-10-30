'use client'

import Onglets, { classeOnglet } from '@/components/ui/Onglets'
import { useState, useMemo, useEffect } from 'react'
import SeanceDetailModal from './SeanceDetailModal'
import DevoirDetailModal from './DevoirDetailModal'
import { clsx } from 'clsx'
import { FloatSelect, FloatInput, SearchField, FloatButton } from '@/components/ui/FloatFields'
import { Puce } from '@/components/dashboard/tdb'
import { typeDevoir, dateLocale, rendPasse } from './commun'
import Tooltip from '@/components/ui/Tooltip'
import RaisonBloquee from '@/components/ui/RaisonBloquee'
import SeanceForm from './SeanceForm'
import DevoirForm from './DevoirForm'
import type { DonneesCahierTexte, SeanceCahier, DevoirCahier } from '@/lib/cahier-texte/donnees'
import { titulaireActuel } from '@/lib/teachers/titulaire'
import { nomCompletEnseignant } from '@/lib/teachers/nom'
import { seanceDeClasse } from '@/components/dashboard/classInfo'

// Donnees de la page : celles de `chargerCahierTexte`, sans recopie.
type Props = Omit<DonneesCahierTexte, 'teacher'> & {
  role: string
  teacherId: string | null
  etablissementId: string
  /** Fiche enseignant du connecte : auteur de ce qu'il ecrit quand il REMPLACE une
   *  seance de la classe (absence d'un collegue, lot 3) sans y etre affecte. */
  moi?: DonneesCahierTexte['teacher']
}

// Carte d'une seance / d'un devoir : bouton, survol par la bordure de marque
// (l'ombre `hover:shadow-md` etait une valeur Tailwind en dur), focus visible.
// `items-baseline` : la date s'aligne sur la LIGNE DE BASE du titre. En
// `items-start`, le titre, centre entre des pastilles plus hautes que lui,
// descendait de quelques pixels sous la date.
const CARTE = 'card px-4 py-3 flex items-baseline gap-3 text-left w-full transition-colors hover:border-[var(--brand-line)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]'

function formatDate(d: string): string {
  return dateLocale(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

// Civilité NOM Prénom : source unique `lib/teachers/nom`.
const teacherName = nomCompletEnseignant

// Valeur spéciale du filtre Classe (staff) : afficher toutes les classes.
const ALL_CLASSES = '__all__'

export default function CahierTexteClient({
  role, classes, journalEntries, homeworkEntries,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
  teacherId, teacherAssignments, allTeachers, allAssignments, etablissementId, moi = null,
}: Props) {
  const [tab, setTab] = useState<'journal' | 'devoirs'>('journal')
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
  const [filterSubject, setFilterSubject] = useState('')

  // Restaure la classe sélectionnée depuis l'URL (?class=) au montage — permet de
  // retrouver sa sélection au retour d'une fiche (lien « Retour » ou bouton Précédent).
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('class')
    if (c === ALL_CLASSES && isStaff) setFilterClass(ALL_CLASSES)
    else if (c && classes.some(cl => cl.id === c)) setFilterClass(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Change la classe + mémorise le choix dans l'URL (sans rechargement).
  const changeClass = (id: string) => {
    setFilterClass(id)
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('class', id)
    else url.searchParams.delete('class')
    window.history.replaceState(null, '', url.toString())
  }

  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState<{ type: 'seance'; entry: SeanceCahier } | { type: 'devoir'; entry: DevoirCahier } | null>(null)

  const selectedClass = classes.find(c => c.id === filterClass) ?? null
  const canCreate = ['admin', 'enseignant', 'direction', 'responsable_pedagogique'].includes(role)
  const isStaff = ['admin', 'direction', 'responsable_pedagogique'].includes(role)
  const isAllClasses = filterClass === ALL_CLASSES

  // Ligne de bas de carte : « Enseignant · Cotisation · Jour HH:MM-HH:MM »
  const classById = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes])
  const subjectsForClass = (classId: string) =>
    [...new Set(((classById.get(classId)?.class_teachers ?? []).map(ct => ct.subject).filter(Boolean) as string[]))].sort()
  const entryMeta = (entry: SeanceCahier | DevoirCahier) => {
    const c = classById.get(entry.class_id)
    // Jour en francais (`seanceDeClasse`) : il s'affichait en anglais brut (« monday »).
    const schedule = c ? seanceDeClasse(c) : ''
    return [teacherName(entry.teachers), c?.cotisation_types?.label, schedule].filter(Boolean).join(' · ')
  }

  // Prof principal + matières de la classe filtrée (pré-remplissage de la création)
  // Titulaire EN POSTE (temps reel), jamais un ancien.
  const mainCT = titulaireActuel(selectedClass?.class_teachers) ?? null
  const mainTeacherId = mainCT?.teachers?.id ?? ''
  const mainTeacherLabel = mainCT?.teachers ? teacherName(mainCT.teachers) : ''
  // Auteur d'une création = enseignant CONNECTÉ s'il est affecté à la classe
  // (titulaire OU remplaçant), sinon le titulaire (cas d'un staff qui crée pour le compte de).
  // Un enseignant qui remplace une séance d'absence n'est pas affecté à la classe :
  // il reste l'auteur (la base n'accepte que lui).
  const meCT = teacherId ? (selectedClass?.class_teachers?.find(ct => ct.teachers?.id === teacherId) ?? null) : null
  const moiAuteur = !meCT && role === 'enseignant' ? moi : null
  const authorId = meCT?.teachers?.id ?? moiAuteur?.id ?? mainTeacherId
  const authorLabel = meCT?.teachers ? teacherName(meCT.teachers) : moiAuteur ? teacherName(moiAuteur) : mainTeacherLabel
  const classSubjects = useMemo(
    () => [...new Set(((selectedClass?.class_teachers ?? []).map(ct => ct.subject).filter(Boolean) as string[]))].sort(),
    [selectedClass]
  )

  // Sujets uniques pour le filtre
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- matiere forcee « General » en V1 (11/07), machinerie du Secondaire conservee
  const subjects = useMemo(() => {
    const set = new Set<string>()
    journalEntries.forEach(j => { if (j.subject) set.add(j.subject) })
    homeworkEntries.forEach(h => { if (h.subject) set.add(h.subject) })
    return [...set].sort()
  }, [journalEntries, homeworkEntries])

  const filteredJournal = useMemo(() => {
    let list = journalEntries
    if (filterClass && filterClass !== ALL_CLASSES) list = list.filter(j => j.class_id === filterClass)
    if (filterSubject) list = list.filter(j => j.subject === filterSubject)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(j => j.title.toLowerCase().includes(q) || stripHtml(j.content_html).toLowerCase().includes(q))
    }
    if (filterClass === ALL_CLASSES) {
      list = [...list].sort((a, b) =>
        (b.session_date ?? '').localeCompare(a.session_date ?? '') ||
        (a.classes?.name ?? '').localeCompare(b.classes?.name ?? ''))
    }
    return list
  }, [journalEntries, filterClass, filterSubject, search])

  const filteredHomework = useMemo(() => {
    let list = homeworkEntries
    if (filterClass && filterClass !== ALL_CLASSES) list = list.filter(h => h.class_id === filterClass)
    if (filterSubject) list = list.filter(h => h.subject === filterSubject)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(h => h.title.toLowerCase().includes(q) || stripHtml(h.description_html).toLowerCase().includes(q))
    }
    if (filterClass === ALL_CLASSES) {
      list = [...list].sort((a, b) =>
        (b.due_date ?? '').localeCompare(a.due_date ?? '') ||
        (a.classes?.name ?? '').localeCompare(b.classes?.name ?? ''))
    }
    return list
  }, [homeworkEntries, filterClass, filterSubject, search])

  return (
    <div className="space-y-4">
      {/* Barre filtres + actions */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">

        {/* `w-fit` est le motif du projet (16 juillet : une largeur figee tronquait
            le libelle). Mais ici l option vaut `nom · enseignant · cotisation`, soit
            ~352 px avec le remplissage, pour ~324 px utiles sur un telephone : le
            select DEBORDAIT. `max-w-full` le borne sans rien changer sur un grand
            ecran, ou le contenu tient. NB : celui de la feuille d appel passe, lui,
            parce que son option s arrete a `nom · enseignant` (~254 px). */}
        <FloatSelect
          label="Classe"
          value={filterClass}
          onChange={e => changeClass(e.target.value)}
          wrapperClassName="w-fit max-w-full"
        >
          <option value=""></option>
          {isStaff && <option value={ALL_CLASSES}>Toutes les classes</option>}
          {classes.map(c => {
            const main = c.class_teachers?.find(t => t.is_main_teacher)
            const teacher = main?.teachers
              ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ')
              : null
            return (
              <option key={c.id} value={c.id}>
                {[c.name, teacher, c.cotisation_types?.label].filter(Boolean).join(' · ')}
              </option>
            )
          })}
        </FloatSelect>

        {/* V1 (mono-mode Primaire) : filtre Matière verrouillé sur « Général ».
            En Secondaire, réactiver le select alimenté par les matières de la classe. */}
        {filterClass && (
          <div className="w-32">
            <FloatInput label="Matière" value="Général" locked readOnly />
          </div>
        )}

        <SearchField value={search} onChange={setSearch} ariaLabel="Rechercher dans le cahier de texte" />

        {/* Droite : infos classe + bouton. `flex-wrap` sur CE groupe et pas seulement
            sur la barre : il ne se propage pas aux enfants, et les deux elements
            (ligne d infos + bouton) resteraient cote a cote sur une seule ligne. */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:ml-auto">
          {selectedClass && (() => {
            const main = selectedClass.class_teachers?.find(t => t.is_main_teacher)
            const teacher = main?.teachers ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ') : null
            const schedule = selectedClass.day_of_week
              ? `${selectedClass.day_of_week}${selectedClass.start_time && selectedClass.end_time ? ` ${selectedClass.start_time.slice(0, 5)}-${selectedClass.end_time.slice(0, 5)}` : ''}`
              : null
            const parts = [teacher, selectedClass.cotisation_types?.label, selectedClass.level ? `Niveau ${selectedClass.level}` : null, schedule].filter(Boolean)
            return parts.length > 0 ? (
              // Motif de la feuille d appel (`AbsencesClient`) : quatre segments joints
              // par « · » ne tiennent pas sur une ligne de telephone, et `nowrap` les
              // faisait sortir du cadre. Ils se replient sous le seuil, restent sur une
              // ligne au-dessus.
              <span className="w-full md:w-auto text-sm font-medium text-warm-700 md:whitespace-nowrap">{parts.join(' · ')}</span>
            ) : null
          })()}
          {canCreate && (() => {
            const addLabel = tab === 'journal' ? 'Ajouter une séance' : 'Ajouter un devoir'
            // La MEME chaine sert l'infobulle et la ligne de petit ecran : deux
            // libelles separes finiraient par diverger.
            const raisonBlocage = `Sélectionnez une classe précise pour ${tab === 'journal' ? 'ajouter une séance' : 'ajouter un devoir'}.`
            return (!filterClass || isAllClasses) ? (
              <>
                <Tooltip content={raisonBlocage}>
                  <FloatButton variant="submit" type="button" disabled className="whitespace-nowrap">
                    {addLabel}
                  </FloatButton>
                </Tooltip>
                <RaisonBloquee raison={raisonBlocage} />
              </>
            ) : (
              <FloatButton
                variant="submit"
                type="button"
                className="whitespace-nowrap"
                disabled={!authorId}
                onClick={() => setShowCreate(true)}
              >
                {addLabel}
              </FloatButton>
            )
          })()}
        </div>
      </div>

      {/* Onglets */}
      <Onglets ariaLabel="Cahier de texte" actifIndex={tab === 'journal' ? 0 : 1}>
        <button
          role="tab"
          id="tab-journal"
          aria-selected={tab === 'journal'}
          aria-controls="panel-journal"
          onClick={() => setTab('journal')}
          className={classeOnglet(tab === 'journal')}
        >
          Journal de séance
        </button>
        <button
          role="tab"
          id="tab-devoirs"
          aria-selected={tab === 'devoirs'}
          aria-controls="panel-devoirs"
          onClick={() => setTab('devoirs')}
          className={classeOnglet(tab === 'devoirs')}
        >
          Devoirs
        </button>
      </Onglets>

      {/* Contenu */}
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {!filterClass ? (
        <div className="card text-center text-sm text-warm-700 py-10">Sélectionnez une classe pour afficher le cahier de texte.</div>
      ) : tab === 'journal' ? (
        filteredJournal.length === 0 ? (
          <div className="card text-center text-sm text-warm-700 py-10">Aucune séance enregistrée.</div>
        ) : (
          <div className="space-y-2">
            {filteredJournal.map(j => (
              <button
                key={j.id}
                type="button"
                onClick={() => setDetail({ type: 'seance', entry: j })}
                className={CARTE}
              >
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="text-xs font-bold text-[var(--brand-surface)] dark:text-[var(--brand-accent)] tabular-nums">{formatDate(j.session_date)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-secondary-800 truncate">{j.title}</h3>
                    <Puce ton="neutre">{j.classes?.name}</Puce>
                    {j.subject && j.subject !== 'General' && (
                      <Puce ton="neutre">{j.subject}</Puce>
                    )}
                  </div>
                  <p className="text-xs text-warm-700 mt-0.5 truncate">
                    {stripHtml(j.content_html).slice(0, 150)}
                  </p>
                  <div className="text-[11px] text-warm-700 mt-1">
                    {entryMeta(j)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        filteredHomework.length === 0 ? (
          <div className="card text-center text-sm text-warm-700 py-10">Aucun devoir enregistré.</div>
        ) : (
          <div className="space-y-2">
            {filteredHomework.map(h => {
              const typeInfo = typeDevoir(h.homework_type)
              // Devoir passe : fond de ligne inactive (et non `opacity-60`, qui faisait
              // tomber le contraste du texte sous AA).
              const isPast = rendPasse(h.due_date)

              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setDetail({ type: 'devoir', entry: h })}
                  className={clsx(CARTE, isPast && 'bg-warm-50')}
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className={clsx('text-xs font-bold tabular-nums', isPast ? 'text-warm-700' : 'text-red-700')}>
                      {formatDate(h.due_date)}
                    </div>
                    <div className="text-[10px] text-warm-700">à rendre</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-secondary-800 truncate">{h.title}</h3>
                      <Puce ton={typeInfo.ton}>{typeInfo.label}</Puce>
                      <Puce ton="neutre">{h.classes?.name}</Puce>
                      {h.subject && h.subject !== 'General' && (
                        <Puce ton="neutre">{h.subject}</Puce>
                      )}
                    </div>
                    <p className="text-xs text-warm-700 mt-0.5 truncate">
                      {stripHtml(h.description_html).slice(0, 150)}
                    </p>
                    <div className="text-[11px] text-warm-700 mt-1">
                      {entryMeta(h)}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )
      )}
      </div>

      {showCreate && selectedClass && authorId && (
        tab === 'journal' ? (
          <SeanceForm
            etablissementId={etablissementId}
            classId={selectedClass.id}
            className={selectedClass.name}
            teacherId={authorId}
            teacherLabel={authorLabel}
            subjects={classSubjects}
            onClose={() => setShowCreate(false)}
            onSaved={() => setShowCreate(false)}
          />
        ) : (
          <DevoirForm
            etablissementId={etablissementId}
            classId={selectedClass.id}
            className={selectedClass.name}
            teacherId={authorId}
            teacherLabel={authorLabel}
            subjects={classSubjects}
            onClose={() => setShowCreate(false)}
            onSaved={() => setShowCreate(false)}
          />
        )
      )}

      {detail?.type === 'seance' && (
        <SeanceDetailModal
          journal={detail.entry}
          role={role}
          teacherId={teacherId}
          subjects={subjectsForClass(detail.entry.class_id)}
          etablissementId={etablissementId}
          onClose={() => setDetail(null)}
        />
      )}
      {detail?.type === 'devoir' && (
        <DevoirDetailModal
          homework={detail.entry}
          role={role}
          teacherId={teacherId}
          isAdult={!!classById.get(detail.entry.class_id)?.cotisation_types?.is_adult}
          subjects={subjectsForClass(detail.entry.class_id)}
          etablissementId={etablissementId}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
