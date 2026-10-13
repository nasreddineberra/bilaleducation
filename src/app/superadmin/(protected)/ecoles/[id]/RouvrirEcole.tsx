'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/lib/toast-context'
import { rouvrirEcole } from '@/app/superadmin/depart-actions'

/** Seul bouton actif d'une fiche dont les données sont effacées. */
export default function RouvrirEcole({ etablissementId, nom }: { etablissementId: string; nom: string }) {
  const router = useRouter()
  const toast = useToast()
  const [aConfirmer, setAConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)

  const rouvrir = async () => {
    setEnCours(true)
    try {
      const r = await rouvrirEcole(etablissementId)
      if (r.error) { toast.error(r.error); return }
      setAConfirmer(false)
      toast.success(`Fiche de « ${nom} » rouverte.`)
      router.refresh()
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      <FloatButton type="button" size="mini" variant="submit" onClick={() => setAConfirmer(true)}>Réouvrir</FloatButton>
      {aConfirmer && (
        <ConfirmModal
          title="Réouvrir la fiche ?"
          message={`« ${nom} » repart vide : aucune donnée n'est restaurée. L'école reste désactivée : réactivez-la, puis créez son compte direction.`}
          confirmLabel="Réouvrir"
          confirmVariant="submit"
          confirmDisabled={enCours}
          onConfirm={rouvrir}
          onCancel={() => setAConfirmer(false)}
        />
      )}
    </>
  )
}
