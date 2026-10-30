'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { FloatSelect, SearchField } from '@/components/ui/FloatFields'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { Puce } from '@/components/dashboard/tdb'
import type { MessageEnvoye } from '@/lib/communications/donnees'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  messages: MessageEnvoye[]
  /** Annee en cours : libelle dynamique « Parents {annee} » (comme l'ecran d'envoi). */
  yearLabel: string | null
}

// Ciblages en `Puce` neutre (21/10), comme dans Notifications : bleu, violet et
// vert etaient hors charte.
const TYPE_LABELS: Record<string, { label: string }> = {
  all_active:     { label: 'Parents (élèves inscrits)' },
  all_registered: { label: 'Tous les contacts' },
  class:          { label: "Parents d'une classe" },
  selected:       { label: 'Parents choisis' },
  staff:          { label: 'Équipe' },
}

// Ordre canonique des ciblages. La liste AFFICHEE en est derivee, en ne gardant
// que les types reellement presents dans les messages recus — motif deja employe
// pour `classOptions` et pour les compteurs de statut (16 juillet : « compteurs
// derives des statuts reellement presents, plus de liste figee »).
//
// C'est ce qui permet d'ouvrir cet ecran a l'enseignant sans lui passer son role :
// la RLS decide ce qu'il recoit, et l'ecran s'y adapte. Une liste en dur lui
// aurait montre un filtre « Parents choisis » ne renvoyant jamais rien.
const FILTRES_ORDRE = ['all_active', 'all_registered', 'class', 'selected', 'staff'] as const

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

  // Ciblages reellement presents : voir FILTRES_ORDRE.
  const filtres = useMemo(() => {
    const presents = new Set(messages.map(m => m.announcement_type))
    return ['', ...FILTRES_ORDRE.filter(t => presents.has(t))]
  }, [messages])

  // Classes reellement presentes dans les messages « Parents d'une classe ».
  // Regle d'affichage select classe : « CODE · Civilite NOM Prenom · COTISATION ».
  const classOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of messages) {
      if (m.announcement_type !== 'class' || !m.target_class_id || !m.classe?.name) continue
      // Historique : titulaires « initial puis remplacant » (decision du 30/10).
      map.set(m.target_class_id, [m.classe.name, m.classe.titulaires, m.classe.cotisation].filter(Boolean).join(' · '))
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
    <div className="h-full flex flex-col gap-2">
      {/* Pas de boutons raccourcis : la creation passe par la sidebar
          (Communications → Parents / Équipe). */}

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3 flex-shrink-0">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par objet…"
          ariaLabel="Rechercher un message par objet"
        />
        <FiltreSwitch
          ariaLabel="Filtrer les messages par ciblage"
          actif={filterType}
          onChange={selectFilter}
          options={filtres.map(type => ({
            valeur:  type,
            nombre:  type === '' ? messages.length : messages.filter(m => m.announcement_type === type).length,
            libelle: type === '' ? 'tous les messages' : typeLabel(type),
          }))}
        />

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
        <div className="card text-center text-sm text-warm-700 py-10">Aucun message envoyé.</div>
      ) : (
        <div className="liste list-scroll flex-1 min-h-0 overflow-y-auto">
          <table className="w-full text-xs" aria-label="Messages envoyés">
            <thead className="sticky top-0 z-10">
              <tr className="liste-entete border-b border-[var(--card-border)]">
                <th scope="col" className="list-th w-2/12">Date</th>
                <th scope="col" className="list-th w-4/12">Objet</th>
                <th scope="col" className="list-th w-3/12">Type</th>
                <th scope="col" className="list-th w-1/12">Dest.</th>
                <th scope="col" className="list-th w-2/12">Expéditeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {filtered.map(m => {
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/dashboard/communications/${m.id}`)}
                    className="cursor-pointer"
                  >
                    <td className="list-td text-warm-700 whitespace-nowrap">{formatDate(m.published_at)}</td>
                    <td className="list-td">
                      <Link
                        href={`/dashboard/communications/${m.id}`}
                        onClick={e => e.stopPropagation()}
                        className="list-name hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
                      >
                        {m.title}
                      </Link>
                    </td>
                    <td className="list-td">
                      <Puce ton="neutre">
                        {typeLabel(m.announcement_type ?? '')}
                        {m.classe?.name ? ` · ${m.classe.name}` : ''}
                      </Puce>
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
