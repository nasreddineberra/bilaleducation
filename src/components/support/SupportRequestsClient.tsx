'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { LifeBuoy } from 'lucide-react'
import { FloatSelect, FloatButton, SearchField } from '@/components/ui/FloatFields'
import SupportRequestModal from './SupportRequestModal'
import SupportRequestDetailModal from './SupportRequestDetailModal'
import { SUPPORT_CATEGORIES, categoryLabel, impactLabel } from '@/lib/support/categories'
import { formatDateHeureFr } from '@/lib/dates'

/**
 * Historique des demandes de support de l'établissement.
 *
 * Calqué sur `SentMessagesClient` — mêmes classes, même structure de filtres,
 * même tableau. Deux écrans qui font la même chose doivent se ressembler ; la
 * direction n'a pas à réapprendre.
 *
 * POURQUOI CET ÉCRAN EXISTE. L'email part par relais SMTP, ce qui ne dépose
 * AUCUNE copie dans le dossier « Envoyés » de la boîte de l'école. Sans cette
 * page, une direction qui se demande « ma demande est-elle partie ? » n'aurait
 * rien à regarder — et la policy SELECT de `support_requests` resterait un
 * droit que rien n'exerce.
 */

export type SupportRequestRow = {
  id: string
  category: string
  impact: string | null
  subject: string
  message: string
  attachment_path: string | null
  context: { page?: string; version?: string; navigateur?: string } | null
  email_status: string
  email_error: string | null
  author_name: string
  author_email: string
  author_role: string
  created_at: string
}

/** Couleurs de nature. Une teinte par catégorie, jamais par rang. */
const CATEGORY_COLORS: Record<string, string> = {
  assistance:  'bg-blue-100 text-blue-700',
  incident:    'bg-red-100 text-red-700',
  information: 'bg-warm-100 text-warm-700',
  suggestion:  'bg-purple-100 text-purple-700',
  facturation: 'bg-amber-100 text-amber-700',
  autre:       'bg-warm-100 text-warm-700',
}

const FILTERS = ['', ...SUPPORT_CATEGORIES.map(c => c.value)] as const

const STORAGE_KEY = 'support-requests-filters'

export default function SupportRequestsClient({
  demandes,
  ecole,
  auteur,
}: {
  demandes: SupportRequestRow[]
  ecole: string | null
  auteur: { nom: string; email: string; role: string } | null
}) {
  const router = useRouter()
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState<string>('')
  // '__all__' : valeur NON vide, sinon le libellé flottant du FloatSelect
  // chevauche le texte de l'option.
  const [filterStatut, setFilterStatut] = useState<string>('__all__')
  const [formOuvert, setFormOuvert] = useState(false)
  const [detail, setDetail]         = useState<SupportRequestRow | null>(null)

  // Filtres mémorisés pour la durée de l'onglet. `hydrated` est un STATE et non
  // un ref : il reste false pendant le commit de montage, donc l'effet de
  // persistance ne réécrit pas les défauts par-dessus le stockage.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const s = JSON.parse(raw)
        if (typeof s.search === 'string')  setSearch(s.search)
        if (typeof s.cat === 'string')     setFilterCat(s.cat)
        if (typeof s.statut === 'string')  setFilterStatut(s.statut)
      }
    } catch { /* stockage indisponible : filtres par défaut */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ search, cat: filterCat, statut: filterStatut }))
    } catch { /* ignore */ }
  }, [hydrated, search, filterCat, filterStatut])

  const filtered = useMemo(() => {
    let list = demandes
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(d => d.subject.toLowerCase().includes(q))
    }
    if (filterCat) list = list.filter(d => d.category === filterCat)
    if (filterStatut === 'sent')   list = list.filter(d => d.email_status === 'sent')
    if (filterStatut === 'failed') list = list.filter(d => d.email_status !== 'sent')
    return list
  }, [demandes, search, filterCat, filterStatut])

  return (
    <div className="space-y-2">

      {/* Bouton d'action, au-dessus des filtres et à gauche : c'est le geste
          principal de l'écran, il ne se cherche pas. Sans icône (règle projet). */}
      <div>
        <FloatButton variant="submit" onClick={() => setFormOuvert(true)}>
          Contacter le support
        </FloatButton>
      </div>

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

        {/* Statut d'envoi : rare, mais c'est l'anomalie qu'on vient chercher.
            Même place que le sous-filtre classe de l'historique des messages. */}
        <FloatSelect
          label="Notification"
          compact
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          wrapperClassName="w-fit ml-auto"
        >
          <option value="__all__">Toutes</option>
          <option value="sent">Transmises</option>
          <option value="failed">Non transmises</option>
        </FloatSelect>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <LifeBuoy size={32} className="mx-auto text-warm-700 mb-2" aria-hidden="true" />
          <p className="text-sm text-warm-700">
            {demandes.length === 0
              ? "Aucune demande envoyée au support."
              : "Aucune demande ne correspond à ces critères."}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-xs" aria-label="Demandes envoyées au support">
            <thead>
              <tr className="border-b border-warm-100">
                <th scope="col" className="list-th w-2/12">Date</th>
                <th scope="col" className="list-th w-4/12">Objet</th>
                <th scope="col" className="list-th w-3/12">Nature</th>
                <th scope="col" className="list-th w-1/12">Notification</th>
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
                      <span className="text-warm-700">Transmise</span>
                    ) : (
                      // Ambre et non rouge : la demande EST enregistrée, c'est
                      // la notification qui manque. Le rouge dirait « perdue ».
                      <span className="text-amber-700 font-medium">Non transmise</span>
                    )}
                  </td>
                  <td className="list-td text-warm-700 truncate">{d.author_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOuvert && (
        <SupportRequestModal
          onClose={() => setFormOuvert(false)}
          onSent={() => { setFormOuvert(false); router.refresh() }}
          ecole={ecole}
          auteur={auteur}
        />
      )}

      {detail && (
        <SupportRequestDetailModal demande={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  )
}
