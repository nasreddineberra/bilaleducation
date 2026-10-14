'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormModal from '@/components/ui/FormModal'
import { useToast } from '@/lib/toast-context'
import { creerEcoleDemo } from '@/app/superadmin/demo-actions'

/**
 * Création de l'école de démonstration. Le mot de passe commun des comptes
 * s'affiche UNE fois ; il est aussi rangé dans les notes internes de la fiche.
 */
export default function CreerEcoleDemo() {
  const router = useRouter()
  const toast = useToast()
  const [aConfirmer, setAConfirmer] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const [cree, setCree] = useState<{ id: string; motDePasse: string } | null>(null)

  const creer = async () => {
    setEnCours(true)
    try {
      const r = await creerEcoleDemo()
      if (r.error || !r.id || !r.motDePasse) { toast.error(r.error ?? 'Création impossible.'); return }
      setAConfirmer(false)
      setCree({ id: r.id, motDePasse: r.motDePasse })
    } finally {
      setEnCours(false)
    }
  }

  return (
    <>
      <FloatButton type="button" variant="secondary" onClick={() => setAConfirmer(true)}>
        Créer l&apos;école de démonstration
      </FloatButton>

      {aConfirmer && (
        <ConfirmModal
          title="Créer l'école de démonstration ?"
          message="Une école « ÉCOLE DÉMONSTRATION » (demonstration.bilaleducation.fr) est créée avec 7 comptes et des données fictives : 4 classes, 60 élèves, 30 familles, notes, absences, emploi du temps et règlements."
          confirmLabel="Créer"
          confirmVariant="submit"
          confirmDisabled={enCours}
          onConfirm={creer}
          onCancel={() => setAConfirmer(false)}
        />
      )}

      {cree && (
        <FormModal
          title="École de démonstration créée"
          onClose={() => { setCree(null); router.push(`/superadmin/ecoles/${cree.id}`) }}
          footer={
            <FloatButton type="button" variant="submit" onClick={() => { setCree(null); router.push(`/superadmin/ecoles/${cree.id}`) }}>
              Voir la fiche
            </FloatButton>
          }
        >
          <div className="space-y-2 text-sm text-secondary-800">
            <p>Mot de passe commun des 7 comptes :</p>
            <p className="font-mono text-base font-semibold bg-warm-50 border border-warm-200 rounded-lg px-3 py-2 select-all">{cree.motDePasse}</p>
            <p className="text-xs text-warm-700">Il est aussi conservé dans les notes internes de la fiche, avec la liste des comptes.</p>
          </div>
        </FormModal>
      )}
    </>
  )
}
