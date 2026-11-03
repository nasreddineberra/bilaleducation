'use client'

import { useState } from 'react'
import { FloatButton } from '@/components/ui/FloatFields'
import { Vide } from '@/components/dashboard/tdb'
import { useToast } from '@/lib/toast-context'
import { useFiltresMemorises } from '@/hooks/useFiltresMemorises'
import { createClient } from '@/lib/supabase/client'
import { ouvrirDansOnglet } from '@/lib/pdf/ouvrir'
import { pluriel } from '@/lib/texte/pluriel'
import SelecteurEnfant from './SelecteurEnfant'

/** Espace famille · Bulletins : une ligne par periode archivee, « Ouvrir le bulletin ». */
export interface BulletinFamille {
  id: string
  groupe: string
  qui: string
  file_path: string
  moyenne_generale: number | null
  absences_count: number | null
  absences_unjustified: number | null
  retards_count: number | null
  classes: { name: string } | null
  periods: { label: string; order_index: number } | null
}

export default function FamilleBulletinsClient({ bulletins }: { bulletins: BulletinFamille[] }) {
  const toast = useToast()
  const [etat, setEtat] = useFiltresMemorises('famille-bulletins', { qui: '' })
  const [ouverture, setOuverture] = useState<string | null>(null)

  const vus = new Set<string>()
  const choix = bulletins.filter(b => !vus.has(b.groupe) && vus.add(b.groupe)).map(b => ({ valeur: b.groupe, libelle: b.qui }))
  const affiches = bulletins.filter(b => !etat.qui || b.groupe === etat.qui)

  // Onglet ouvert AU CLIC (avant l'await), adresse signee 60 s.
  const ouvrir = async (b: BulletinFamille) => {
    setOuverture(b.id)
    const ok = await ouvrirDansOnglet(async () => {
      const { data, error } = await createClient().storage.from('bulletins').createSignedUrl(b.file_path, 60)
      return error ? null : data?.signedUrl ?? null
    })
    setOuverture(null)
    if (!ok) toast.error('Le bulletin n’a pas pu être ouvert.')
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <SelecteurEnfant choix={choix} valeur={etat.qui} onChange={v => setEtat({ qui: v })} />

      {affiches.length === 0 ? <Vide>Aucun bulletin archivé cette année.</Vide> : (
        <ul className="liste">
          {affiches.map(b => (
            <li key={b.id} className="flex items-center gap-3 px-3 py-2 text-xs flex-wrap">
              <span className="min-w-0 flex-1">
                <span className="list-name text-secondary-800 block">
                  {b.periods?.label ?? 'Période'}{choix.length > 1 ? ` · ${b.qui}` : ''}
                </span>
                <span className="text-warm-700 block">
                  {[
                    b.classes?.name,
                    b.moyenne_generale !== null ? `Moyenne ${Number(b.moyenne_generale).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}` : null,
                    b.absences_count ? pluriel(b.absences_count, 'absence') : null,
                    b.retards_count ? pluriel(b.retards_count, 'retard') : null,
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
              <FloatButton type="button" variant="edit" size="mini" loading={ouverture === b.id} disabled={ouverture === b.id}
                onClick={() => ouvrir(b)}>
                Ouvrir le bulletin
              </FloatButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
