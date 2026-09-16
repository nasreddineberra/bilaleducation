'use client'

import { useState, useMemo, useEffect } from 'react'
import { clsx } from 'clsx'
import { LifeBuoy } from 'lucide-react'
import { FloatSelect, SearchField } from '@/components/ui/FloatFields'
import SupportRequestDetailModal from '@/components/support/SupportRequestDetailModal'
import { CATEGORY_COLORS, type SupportRequestRow } from '@/components/support/SupportRequestsClient'
import { SUPPORT_CATEGORIES, categoryLabel, impactLabel } from '@/lib/support/categories'
import { getSupportAttachmentUrlEditeur } from '@/app/superadmin/support-actions'
import { formatDateHeureFr } from '@/lib/dates'

/**
 * Demandes de support de TOUTES les écoles, vues de la console de l'éditeur.
 *
 * Calqué sur `SupportRequestsClient` (l'écran de l'école) : mêmes classes, même
 * structure. Ce qui change : une colonne et un filtre ÉTABLISSEMENT, pas de
 * bouton d'envoi, et la modale en vue éditeur.
 *
 * POURQUOI CET ÉCRAN EXISTE. Une demande est ÉCRITE en base avant d'être
 * envoyée par email — c'est ce qui permet de signaler « ma messagerie ne
 * marche plus ». Mais ce garde-fou n'a de sens que si quelqu'un lit la table :
 * sans cet écran, une demande dont l'email n'est pas parti existait sans que
 * personne ne la voie. L'école croyait avoir écrit, l'éditeur ne savait pas.
 */

export type SupportRequestConsoleRow = SupportRequestRow & {
  etablissement_id: string
  ecole: string
}

const FILTERS = ['', ...SUPPORT_CATEGORIES.map(c => c.value)] as const

const STORAGE_KEY = 'console-support-filters'

export default function SupportRequestsConsoleClient({
  demandes,
}: {
  demandes: SupportRequestConsoleRow[]
}) {
  const [search, setSearch]           = useState('')
  const [filterCat, setFilterCat]     = useState<string>('')
  // '__all__' : valeur NON vide, sinon le libellé flottant du FloatSelect
  // chevauche le texte de l'option.
  const [filterEcole, setFilterEcole]   = useState<string>('__all__')
  const [filterStatut, setFilterStatut] = useState<string>('__all__')
  const [detail, setDetail]             = useState<SupportRequestConsoleRow | null>(null)

  // Filtres mémorisés pour la durée de l'onglet. `hydrated` est un STATE et non
  // un ref : il reste false pendant le commit de montage, donc l'effet de
  // persistance ne réécrit pas les défauts par-dessus le stockage.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (typeof s.search === 'string') setSearch(s.search)
        if (typeof s.cat === 'string')    setFilterCat(s.cat)
        if (typeof s.ecole === 'string')  setFilterEcole(s.ecole)
        if (typeof s.statut === 'string') setFilterStatut(s.statut)
      }
    } catch { /* stockage indisponible : filtres par défaut */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ search, cat: filterCat, ecole: filterEcole, statut: filterStatut }))
    } catch { /* ignore */ }
  }, [hydrated, search, filterCat, filterEcole, filterStatut])

  // Les écoles réellement présentes, pas la liste de tous les clients : un
  // filtre qui ne filtre rien n'a pas sa place.
  const ecoles = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of demandes) m.set(d.etablissement_id, d.ecole)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'fr'))
  }, [demandes])

  const filtered = useMemo(() => {
    let list = demandes
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d => d.subject.toLowerCase().includes(q))
    }
    if (filterCat) list = list.filter(d => d.category === filterCat)
    if (filterEcole !== '__all__') list = list.filter(d => d.etablissement_id === filterEcole)
    if (filterStatut === 'sent')   list = list.filter(d => d.email_status === 'sent')
    if (filterStatut === 'failed') list = list.filter(d => d.email_status !== 'sent')
    return list
  }, [demandes, search, filterCat, filterEcole, filterStatut])

  return (
    <div className="space-y-2">

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par objet…"
          ariaLabel="Rechercher une demande par objet"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map(cat => {
            const active = filterCat === cat
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => setFilterCat(cat)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                  active
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-warm-200 text-warm-700 bg-white hover:bg-warm-50'
                )}
              >
                {cat === '' ? 'Toutes les demandes' : categoryLabel(cat)}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {ecoles.length > 1 && (
            <FloatSelect
              label="Établissement"
              compact
              value={filterEcole}
              onChange={e => setFilterEcole(e.target.value)}
              wrapperClassName="w-fit"
            >
              <option value="__all__">Tous</option>
              {ecoles.map(([id, nom]) => (
                <option key={id} value={id}>{nom}</option>
              ))}
            </FloatSelect>
          )}
          <FloatSelect
            label="Email"
            compact
            value={filterStatut}
            onChange={e => setFilterStatut(e.target.value)}
            wrapperClassName="w-fit"
          >
            <option value="__all__">Toutes</option>
            <option value="sent">Reçues</option>
            <option value="failed">Non reçues</option>
          </FloatSelect>
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <LifeBuoy size={32} className="mx-auto text-warm-700 mb-2" aria-hidden="true" />
          <p className="text-sm text-warm-700">
            {demandes.length === 0
              ? 'Aucune demande de support.'
              : 'Aucune demande ne correspond à ces critères.'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-xs" aria-label="Demandes de support des établissements">
            <thead>
              <tr className="border-b border-warm-100">
                <th scope="col" className="list-th w-2/12">Date</th>
                <th scope="col" className="list-th w-2/12">Établissement</th>
                <th scope="col" className="list-th w-3/12">Objet</th>
                <th scope="col" className="list-th w-2/12">Nature</th>
                <th scope="col" className="list-th w-1/12">Email</th>
                <th scope="col" className="list-th w-2/12">Auteur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {filtered.map(d => (
                <tr
                  key={d.id}
                  onClick={() => setDetail(d)}
                  className="hover:bg-warm-50 transition-colors cursor-pointer"
                >
                  <td className="list-td text-warm-700 whitespace-nowrap">
                    {formatDateHeureFr(d.created_at)}
                  </td>
                  <td className="list-td text-secondary-800 truncate">{d.ecole}</td>
                  <td className="list-td">
                    {/* Vrai bouton : la ligne est cliquable à la souris, le
                        clavier doit avoir une cible propre. */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setDetail(d) }}
                      className="list-name hover:underline text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    >
                      {d.subject}
                    </button>
                  </td>
                  <td className="list-td">
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      CATEGORY_COLORS[d.category] ?? 'bg-warm-100 text-warm-700'
                    )}>
                      {categoryLabel(d.category)}
                      {d.impact ? ` · ${impactLabel(d.impact)}` : ''}
                    </span>
                  </td>
                  <td className="list-td">
                    {d.email_status === 'sent' ? (
                      <span className="text-warm-700">Reçue</span>
                    ) : (
                      // Ambre : la demande EST là, c'est l'email qui manque —
                      // et c'est précisément celle-ci que l'écran sert à voir.
                      <span className="text-amber-700 font-medium">Non reçue</span>
                    )}
                  </td>
                  <td className="list-td text-warm-700 truncate">{d.author_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <SupportRequestDetailModal
          demande={detail}
          ecole={detail.ecole}
          vue="editeur"
          signer={getSupportAttachmentUrlEditeur}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
