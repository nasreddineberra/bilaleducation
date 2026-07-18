'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Mail, Users, UserCheck, Globe } from 'lucide-react'
import { FloatSelect, SearchField } from '@/components/ui/FloatFields'

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassTeacher = {
  is_main_teacher: boolean
  teachers: { civilite: string | null; first_name: string; last_name: string } | null
}

type MessageRow = {
  id: string
  title: string
  announcement_type: string | null
  target_class_id: string | null
  channel: string | null
  recipient_count: number | null
  published_at: string | null
  sent_at: string | null
  published_by: string | null
  profiles: { first_name: string; last_name: string } | null
  classes: { name: string; class_teachers?: ClassTeacher[] } | null
}

interface Props {
  messages: MessageRow[]
  /** Annee en cours : libelle dynamique « Parents {annee} » (comme l'ecran d'envoi). */
  yearLabel: string | null
}

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  all_active:     { label: 'Parents (élèves inscrits)', icon: Users,     color: 'bg-blue-100 text-blue-700' },
  all_registered: { label: 'Tous les contacts',         icon: Globe,     color: 'bg-purple-100 text-purple-700' },
  class:          { label: "Parents d'une classe",      icon: UserCheck, color: 'bg-amber-100 text-amber-700' },
  selected:       { label: 'Parents choisis',           icon: UserCheck, color: 'bg-green-100 text-green-700' },
  staff:          { label: 'Staff interne',             icon: Users,     color: 'bg-warm-100 text-warm-700' },
}

const FILTERS = ['', 'all_active', 'all_registered', 'class', 'selected', 'staff'] as const

// Filtres memorises pour la duree de l'onglet : au retour d'une fiche message,
// on retrouve sa recherche et son ciblage.
const STORAGE_KEY = 'comm-sent-filters'

function formatDate(d: string | null): string {
  if (!d) return '·'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SentMessagesClient({ messages, yearLabel }: Props) {
  const router = useRouter()
  // « Parents {annee} » si une annee est en cours, sinon repli.
  const allActiveLabel = yearLabel ? `Parents ${yearLabel}` : 'Parents (élèves inscrits)'
  const typeLabel = (type: string) => type === 'all_active' ? allActiveLabel : (TYPE_LABELS[type]?.label ?? type)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  // '__all__' = toutes les classes. Valeur non vide (et non '') pour que le label
  // flottant du FloatSelect monte au lieu de chevaucher le texte de l'option.
  const [filterClassId, setFilterClassId] = useState<string>('__all__')

  // Restauration au montage puis persistance a chaque changement (sessionStorage :
  // survit au retour depuis une fiche, quel que soit le chemin — lien ou Precedent).
  // `hydrated` est un STATE (pas un ref) : il reste false pendant le commit de
  // montage, donc l'effet de persistance ne reecrit pas les defauts par-dessus le
  // stockage avant que les valeurs restaurees ne soient appliquees.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (typeof s.search === 'string') setSearch(s.search)
        if (typeof s.type === 'string') setFilterType(s.type)
        if (typeof s.classId === 'string') setFilterClassId(s.classId)
      }
    } catch { /* stockage indisponible : filtres par defaut */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ search, type: filterType, classId: filterClassId }))
    } catch { /* ignore */ }
  }, [hydrated, search, filterType, filterClassId])

  // Classes reellement presentes dans les messages « Parents d'une classe ».
  // Meme libelle que « Affectations apprenants » : « Nom · Civilite NOM Prenom ».
  const classOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of messages) {
      if (m.announcement_type !== 'class' || !m.target_class_id || !m.classes?.name) continue
      const main = m.classes.class_teachers?.find(t => t.is_main_teacher)
      const teacher = main?.teachers
        ? [main.teachers.civilite, main.teachers.last_name, main.teachers.first_name].filter(Boolean).join(' ')
        : null
      map.set(m.target_class_id, [m.classes.name, teacher].filter(Boolean).join(' · '))
    }
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [messages])

  const filtered = useMemo(() => {
    let list = messages
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.title.toLowerCase().includes(q))
    }
    if (filterType) {
      list = list.filter(m => m.announcement_type === filterType)
    }
    if (filterType === 'class' && filterClassId !== '__all__') {
      list = list.filter(m => m.target_class_id === filterClassId)
    }
    return list
  }, [messages, search, filterType, filterClassId])

  const selectFilter = (type: string) => {
    setFilterType(type)
    if (type !== 'class') setFilterClassId('__all__')   // le sous-filtre classe ne vaut que pour ce type
  }

  return (
    <div className="space-y-2">
      {/* Pas de boutons raccourcis : la creation passe par la sidebar
          (Communications → Parents / Staff). */}

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par objet…"
          ariaLabel="Rechercher un message par objet"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(type => {
            const active = filterType === type
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => selectFilter(type)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  active
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-warm-200 text-warm-700 bg-white hover:bg-warm-50'
                )}
              >
                {type === '' ? 'Tous les messages' : typeLabel(type)}
              </button>
            )
          })}
        </div>

        {/* Sous-filtre : quelle classe, quand « Parents d'une classe » est actif.
            Meme FloatSelect que « Affectations apprenants », en mini hauteur. */}
        {filterType === 'class' && classOptions.length > 0 && (
          <FloatSelect
            label="Classe"
            compact
            value={filterClassId}
            onChange={e => setFilterClassId(e.target.value)}
            wrapperClassName="w-fit ml-auto"
          >
            <option value="__all__">Toutes les classes</option>
            {classOptions.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </FloatSelect>
        )}
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <Mail size={32} className="mx-auto text-warm-700 mb-2" aria-hidden="true" />
          <p className="text-sm text-warm-700">Aucun message envoyé.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-xs" aria-label="Messages envoyés">
            <thead>
              <tr className="border-b border-warm-100">
                <th scope="col" className="list-th w-2/12">Date</th>
                <th scope="col" className="list-th w-4/12">Objet</th>
                <th scope="col" className="list-th w-3/12">Type</th>
                <th scope="col" className="list-th w-1/12">Dest.</th>
                <th scope="col" className="list-th w-2/12">Expéditeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {filtered.map(m => {
                const typeInfo = TYPE_LABELS[m.announcement_type ?? ''] ?? { label: m.announcement_type ?? '·', icon: Mail, color: 'bg-warm-100 text-warm-700' }
                const TypeIcon = typeInfo.icon
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/dashboard/communications/${m.id}`)}
                    className="hover:bg-warm-50 transition-colors cursor-pointer"
                  >
                    <td className="list-td text-warm-700 whitespace-nowrap">{formatDate(m.published_at)}</td>
                    <td className="list-td">
                      <Link
                        href={`/dashboard/communications/${m.id}`}
                        onClick={e => e.stopPropagation()}
                        className="list-name hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                      >
                        {m.title}
                      </Link>
                    </td>
                    <td className="list-td">
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', typeInfo.color)}>
                        <TypeIcon size={10} aria-hidden="true" />
                        {typeLabel(m.announcement_type ?? '')}
                        {m.classes?.name ? ` · ${m.classes.name}` : ''}
                      </span>
                    </td>
                    <td className="list-td text-warm-700 tabular-nums">{m.recipient_count ?? '·'}</td>
                    <td className="list-td text-warm-700">
                      {m.profiles ? `${m.profiles.last_name} ${m.profiles.first_name}` : '·'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
