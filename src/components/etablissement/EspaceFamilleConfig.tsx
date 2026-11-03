'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { Puce } from '@/components/dashboard/tdb'
import { useToast } from '@/lib/toast-context'
import { basculerEspaceFamille } from '@/app/dashboard/etablissement/espace-famille-actions'

/**
 * Parametres · Etablissement · Espace famille (decision 17) : l'interrupteur de
 * l'ecole, affiche si l'option est souscrite (console). Activer ouvre l'acces
 * aux familles et l'envoi des invitations ; desactiver est temporaire.
 */
export default function EspaceFamilleConfig({ ouvert }: { ouvert: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [enCours, setEnCours] = useState(false)
  const [confirmer, setConfirmer] = useState(false)

  const basculer = async (valeur: boolean) => {
    setEnCours(true)
    const res = await basculerEspaceFamille(valeur)
    setEnCours(false)
    setConfirmer(false)
    if (res.error) { toast.error(res.error); return }
    toast.success(valeur ? 'Espace famille activé.' : 'Espace famille désactivé.')
    router.refresh()
  }

  return (
    <div className="card p-4 [--encadre-pad:1rem] space-y-3">
      <div className="encadre-titre gap-3">
        <h2 className="text-xs font-bold uppercase tracking-widest">Espace famille</h2>
        <span className="ml-auto"><Puce ton={ouvert ? 'ok' : 'neutre'}>{ouvert ? 'Activé' : 'Désactivé'}</Puce></span>
      </div>
      <p className="text-sm text-warm-700">
        {ouvert
          ? 'Les familles invitées accèdent à leur espace. Les invitations s’envoient depuis Paramètres · Utilisateurs, onglet « Parents ».'
          : 'Les familles n’ont pas accès à leur espace. Leurs comptes sont conservés.'}
      </p>
      <div className="flex justify-end">
        {ouvert ? (
          <FloatButton type="button" variant="danger" disabled={enCours} onClick={() => setConfirmer(true)}>
            Désactiver l’espace famille
          </FloatButton>
        ) : (
          <FloatButton type="button" variant="submit" loading={enCours} disabled={enCours} onClick={() => basculer(true)}>
            Activer l’espace famille
          </FloatButton>
        )}
      </div>

      {confirmer && (
        <ConfirmModal
          title="Désactiver l’espace famille ?"
          confirmLabel="Désactiver"
          variant="danger"
          confirmDisabled={enCours}
          onConfirm={() => basculer(false)}
          onCancel={() => setConfirmer(false)}
        >
          <p className="text-sm text-warm-700">Les familles n’auront plus accès à leur espace. Leurs comptes sont conservés : en le réactivant, elles retrouvent leur accès sans nouvelle invitation.</p>
        </ConfirmModal>
      )}
    </div>
  )
}
