'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { useToast } from '@/lib/toast-context'
import { reinitialiserEcoleDemo } from '@/app/superadmin/demo-actions'

/** Remise à zéro de l'école de démonstration : données refaites, comptes conservés. */
export default function ReinitialiserDemo({ etablissementId }: { etablissementId: string }) {
  const router = useRouter()
  const toast = useToast()
  const [aConfirmer, setAConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)

  const reinitialiser = async () => {
    setEnCours(true)
    try {
      const r = await reinitialiserEcoleDemo(etablissementId)
      if (r.error) { toast.error(r.error); return }
      setAConfirmer(false)
      if (r.logo === false) toast.warning("L'école de démonstration est remise à zéro, mais son logo n'a pas pu être posé.")
      else toast.success("L'école de démonstration est remise à zéro.")
      router.refresh()
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      {/* Meme taille qu'« Intervenir », a cote duquel il se place. */}
      <FloatButton type="button" size="normal" variant="secondary" loading={enCours} onClick={() => setAConfirmer(true)}>
        Réinitialiser
      </FloatButton>
      {aConfirmer && (
        <ConfirmModal
          title="Réinitialiser l'école de démonstration ?"
          message="Toutes les données de l'école sont effacées puis recréées, datées d'aujourd'hui. Les comptes de connexion et leur double authentification sont conservés."
          confirmLabel="Réinitialiser"
          confirmVariant="submit"
          confirmDisabled={enCours}
          onConfirm={reinitialiser}
          onCancel={() => setAConfirmer(false)}
        />
      )}
    </>
  )
}
