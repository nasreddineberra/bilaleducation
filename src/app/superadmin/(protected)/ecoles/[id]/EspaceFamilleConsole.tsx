'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton, FloatInput } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { basculerOptionFamille, enregistrerTarifFamille } from '@/app/superadmin/famille-actions'
import { optionActivable, RAISON_ECOLE_OUVERTE, RAISON_VERROU } from '@/lib/espace-famille/disponibilite'

/**
 * Console · fiche ecole · Espace famille (decisions 17 a 20) : l'option
 * souscrite (activer / desactiver), son tarif (forfait + prix par inscrit, meme
 * base que le tarif de base), l'etat de l'ecole et ses comptes parents.
 */
const lireMontant = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))
const texte = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

export default function EspaceFamilleConsole({ etablissementId, estDemo, option, ouvert, tarif, comptes }: {
  etablissementId: string
  estDemo: boolean
  option: boolean
  ouvert: boolean
  tarif: { forfait: number | null; prix: number | null }
  comptes: { invites: number; configures: number; desactives: number }
}) {
  const router = useRouter()
  const [forfait, setForfait] = useState(texte(tarif.forfait))
  const [prix, setPrix] = useState(texte(tarif.prix))
  const [enCours, setEnCours] = useState(false)
  const [confirmer, setConfirmer] = useState<null | 'activer' | 'desactiver'>(null)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  const f = lireMontant(forfait)
  const p = lireMontant(prix)
  const invalide = (v: number | null) => v !== null && (!Number.isFinite(v) || v < 0)
  const tarifChange = forfait !== texte(tarif.forfait) || prix !== texte(tarif.prix)
  const raisonActiver = !optionActivable(estDemo) ? RAISON_VERROU : null
  const raisonDesactiver = ouvert ? RAISON_ECOLE_OUVERTE : null

  const agir = async (action: () => Promise<{ error?: string }>, succes: string) => {
    setEnCours(true); setMessage(null)
    const r = await action()
    setEnCours(false); setConfirmer(null)
    setMessage(r.error ? { ok: false, texte: r.error } : { ok: true, texte: succes })
    if (!r.error) router.refresh()
  }

  const bouton = option ? (
    <FloatButton type="button" size="mini" variant="danger" disabled={enCours || !!raisonDesactiver} onClick={() => setConfirmer('desactiver')}>
      Désactiver l’espace famille
    </FloatButton>
  ) : (
    <FloatButton type="button" size="mini" variant="submit" disabled={enCours || !!raisonActiver} onClick={() => setConfirmer('activer')}>
      Activer l’espace famille
    </FloatButton>
  )
  const raison = option ? raisonDesactiver : raisonActiver

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Espace famille</h2>
        <span className="text-xs font-semibold text-secondary-800">
          {!option ? 'Non souscrit' : ouvert ? 'Souscrit · ouvert par l’école' : 'Souscrit · fermé par l’école'}
        </span>
      </div>

      {option && (
        <p className="text-xs text-warm-700 tabular-nums">
          {comptes.invites} tuteur{comptes.invites > 1 ? 's' : ''} invité{comptes.invites > 1 ? 's' : ''} · {comptes.configures} accès configuré{comptes.configures > 1 ? 's' : ''}
          {comptes.desactives > 0 && ` · ${comptes.desactives} désactivé${comptes.desactives > 1 ? 's' : ''}`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <FloatInput bordure compact label="Forfait mensuel (€)" inputMode="decimal" value={forfait}
          onChange={e => setForfait(e.target.value)} error={invalide(f) ? 'Montant invalide.' : undefined} />
        <FloatInput bordure compact label="Prix par inscrit (€)" inputMode="decimal" value={prix}
          onChange={e => setPrix(e.target.value)} error={invalide(p) ? 'Montant invalide.' : undefined} />
      </div>

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-xs ton-ok rounded-lg px-3 py-1.5' : 'text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5'}>
          {message.texte}
        </p>
      )}

      <div className="flex items-center gap-2 justify-end">
        <FloatButton type="button" size="mini" variant="edit" loading={enCours && !confirmer}
          disabled={enCours || !tarifChange || invalide(f) || invalide(p)}
          onClick={() => agir(() => enregistrerTarifFamille(etablissementId, { forfait: f, prix: p }), 'Tarif enregistré.')}>
          Enregistrer le tarif
        </FloatButton>
        {raison ? <Tooltip content={raison}>{bouton}</Tooltip> : bouton}
      </div>

      {confirmer && (
        <ConfirmModal
          title={confirmer === 'activer' ? 'Activer l’espace famille ?' : 'Désactiver l’espace famille ?'}
          confirmLabel={confirmer === 'activer' ? 'Activer' : 'Désactiver'}
          variant={confirmer === 'activer' ? 'warning' : 'danger'}
          confirmDisabled={enCours}
          onConfirm={() => agir(() => basculerOptionFamille(etablissementId, confirmer === 'activer'),
            confirmer === 'activer' ? 'Espace famille activé.' : 'Espace famille désactivé.')}
          onCancel={() => setConfirmer(null)}
        >
          <p className="text-sm text-warm-700">
            {confirmer === 'activer'
              ? 'L’option est facturée dès ce mois-ci. L’école l’ouvre ensuite à ses familles depuis Paramètres · Établissement.'
              : 'L’option n’est plus proposée à l’école. Le mois commencé reste dû.'}
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}
