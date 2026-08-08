'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import FormModal from '@/components/ui/FormModal'
import { FloatButton } from '@/components/ui/FloatFields'
import { categoryLabel, impactLabel } from '@/lib/support/categories'
import { formatDateHeureFr } from '@/lib/dates'
import { getSupportAttachmentUrl } from '@/app/dashboard/support/actions'
import type { SupportRequestRow } from './SupportRequestsClient'

/**
 * Consultation d'une demande envoyée. Lecture seule : une demande partie ne se
 * retouche pas — la base le garantit aussi (ni policy UPDATE, ni DELETE).
 */
export default function SupportRequestDetailModal({
  demande,
  onClose,
}: {
  demande: SupportRequestRow
  onClose: () => void
}) {
  const [erreurPJ, setErreurPJ] = useState('')

  async function ouvrirPieceJointe() {
    setErreurPJ('')
    // Onglet ouvert AVANT l'attente : ouvert après, le navigateur le prend pour
    // une fenêtre surgissante et le bloque. Leçon de l'attestation de paiement.
    const onglet = window.open('', '_blank')
    const res = await getSupportAttachmentUrl(demande.id)
    if (res.url) {
      if (onglet) onglet.location.href = res.url
      else window.open(res.url, '_blank')
    } else {
      onglet?.close()
      setErreurPJ(res.error ?? "Le fichier n'a pas pu être ouvert.")
    }
  }

  const info = (cle: string, valeur: string) => (
    <div className="flex gap-2">
      <dt className="text-warm-700 w-24 shrink-0">{cle}</dt>
      <dd className="text-secondary-800 min-w-0 break-words">{valeur}</dd>
    </div>
  )

  return (
    <FormModal
      title="Demande envoyée au support"
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <div className="flex justify-end w-full">
          <FloatButton variant="secondary" onClick={onClose}>Fermer</FloatButton>
        </div>
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-warm-100 text-warm-700">
          {categoryLabel(demande.category)}
          {demande.impact ? ` · ${impactLabel(demande.impact)}` : ''}
        </span>
        <span className="text-xs text-warm-700">{formatDateHeureFr(demande.created_at)}</span>
      </div>

      <h3 className="text-base font-bold text-secondary-800">{demande.subject}</h3>

      {/* `whitespace-pre-wrap` : le message a été saisi dans un champ multiligne,
          ses retours à la ligne font partie du propos. */}
      <p className="text-sm text-secondary-800 whitespace-pre-wrap leading-relaxed bg-warm-50 rounded-lg px-3 py-2.5">
        {demande.message}
      </p>

      {demande.attachment_path && (
        <div>
          <button
            type="button"
            onClick={ouvrirPieceJointe}
            className="text-sm text-primary-700 hover:text-primary-800 underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            Voir la pièce jointe
          </button>
          {erreurPJ && <p role="alert" className="text-xs text-red-700 mt-1">{erreurPJ}</p>}
        </div>
      )}

      {/* État de la notification. Ambre et non rouge sur un échec : la demande
          EST enregistrée, c'est l'email qui n'est pas parti. Le rouge dirait
          « perdue », et ferait réécrire pour rien. */}
      <div className={clsx(
        'rounded-lg px-3 py-2 text-xs',
        demande.email_status === 'sent'
          ? 'bg-primary-50 text-primary-700'
          : 'bg-amber-50 text-amber-700'
      )}>
        {demande.email_status === 'sent' ? (
          'Notification transmise au support.'
        ) : (
          <>
            <strong>Notification non transmise.</strong> Votre demande est bien enregistrée et
            reste consultable ici, mais l&apos;email n&apos;a pas pu partir. Vérifiez la messagerie
            de l&apos;établissement dans Paramètres → Établissement → Messagerie.
          </>
        )}
      </div>

      <dl className="space-y-1 text-xs border-t border-warm-100 pt-3">
        {info('Auteur',     `${demande.author_name} (${demande.author_role})`)}
        {info('Email',      demande.author_email)}
        {info('Page',       demande.context?.page || 'Non renseignée')}
        {info('Version',    demande.context?.version || 'Inconnue')}
        {info('Navigateur', demande.context?.navigateur || 'Inconnu')}
      </dl>
    </FormModal>
  )
}
