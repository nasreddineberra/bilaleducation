'use client'

import { useState, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Paperclip, X } from 'lucide-react'
import FormModal from '@/components/ui/FormModal'
import { FloatInput, FloatSelect, FloatTextarea, FloatButton } from '@/components/ui/FloatFields'
import Tooltip from '@/components/ui/Tooltip'
import { useToast } from '@/lib/toast-context'
import { APP_VERSION } from '@/lib/app-version'
import { sendSupportRequest } from '@/app/dashboard/support/actions'
import {
  SUPPORT_CATEGORIES,
  SUPPORT_IMPACTS,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_ATTACHMENT_TYPES,
} from '@/lib/support/categories'

/**
 * Formulaire de demande de support, de l'école vers l'éditeur.
 *
 * MODALE VERROUILLÉE (`FormModal`) : ni clic sur le fond, ni Échap. Une demande
 * de support se rédige, parfois longuement, et souvent dans l'agacement d'un
 * problème — la perdre d'un clic à côté serait le pire moment.
 *
 * CE QUI DISTINGUE CE FORMULAIRE D'UN SIMPLE EMAIL : le contexte s'attache
 * seul. La direction décrit son problème, l'application joint la page d'où
 * part la demande, sa version et le navigateur. Sur un incident, c'est le
 * premier aller-retour économisé à chaque fois.
 *
 * Ce contexte est MONTRÉ, replié mais consultable. Une application qui
 * transmet des informations sur son utilisateur les lui affiche.
 */
export default function SupportRequestModal({
  onClose,
  ecole,
  auteur,
}: {
  onClose: () => void
  ecole: string | null
  auteur: { nom: string; email: string; role: string } | null
}) {
  const pathname = usePathname()
  const toast = useToast()

  const [category, setCategory] = useState('')
  const [impact, setImpact]     = useState('')
  const [subject, setSubject]   = useState('')
  const [message, setMessage]   = useState('')
  const [fichier, setFichier]   = useState<File | null>(null)
  const [erreur, setErreur]     = useState('')
  const [envoi, setEnvoi]       = useState(false)
  const [contexteOuvert, setContexteOuvert] = useState(false)
  const inputFichier = useRef<HTMLInputElement>(null)

  const estIncident = category === 'incident'

  // Le bouton reste inerte tant que l'obligatoire manque — règle du projet.
  // L'impact ne compte comme obligatoire que là où il s'affiche.
  const complet = useMemo(
    () => Boolean(category && subject.trim() && message.trim() && (!estIncident || impact)),
    [category, subject, message, estIncident, impact]
  )

  function choisirFichier(f: File | null) {
    setErreur('')
    if (!f) return setFichier(null)
    if (!SUPPORT_ATTACHMENT_TYPES.includes(f.type as never)) {
      setErreur('Pièce jointe : images (PNG, JPEG, WebP) et PDF uniquement.')
      return
    }
    if (f.size > SUPPORT_ATTACHMENT_MAX_BYTES) {
      setErreur('Pièce jointe : 2 Mo maximum.')
      return
    }
    setFichier(f)
  }

  async function envoyer() {
    if (!complet || envoi) return
    setEnvoi(true)
    setErreur('')

    const fd = new FormData()
    fd.set('category', category)
    if (estIncident) fd.set('impact', impact)
    fd.set('subject', subject.trim())
    fd.set('message', message.trim())
    fd.set('page', pathname ?? '')
    fd.set('version', APP_VERSION)
    fd.set('userAgent', typeof navigator !== 'undefined' ? navigator.userAgent : '')
    if (fichier) fd.set('attachment', fichier)

    const res = await sendSupportRequest(fd)

    // La demande peut être ENREGISTRÉE sans que la notification parte. Ce n'est
    // pas un échec : la refuser ferait tout recommencer à l'utilisateur, pour
    // rien. On ferme, en disant ce qui s'est réellement passé.
    if (res.enregistree) {
      if (res.emailEnvoye) toast.success('Votre demande a été transmise au support.')
      else                 toast.warning(res.error ?? 'Votre demande est enregistrée.')
      onClose()
      return
    }

    setEnvoi(false)
    setErreur(res.error ?? "La demande n'a pas pu être envoyée.")
  }

  return (
    <FormModal
      title="Contacter le support"
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <p className="text-xs text-warm-700">* champs obligatoires</p>
          <div className="flex items-center gap-2">
            <FloatButton variant="secondary" onClick={onClose} disabled={envoi}>
              Annuler
            </FloatButton>
            <FloatButton variant="submit" onClick={envoyer} disabled={!complet || envoi}>
              {envoi ? 'Envoi…' : 'Envoyer'}
            </FloatButton>
          </div>
        </div>
      }
    >
      {erreur && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
          {erreur}
        </p>
      )}

      <FloatSelect
        label="Nature de la demande"
        required
        value={category}
        onChange={e => { setCategory(e.target.value); setImpact('') }}
      >
        {/* Select vide au départ, placeholder non sélectionnable — règle du projet. */}
        <option value="" disabled hidden></option>
        {SUPPORT_CATEGORIES.map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </FloatSelect>

      {/* L'aide décrit la nature choisie : elle lève l'hésitation entre deux
          catégories voisines au moment où elle se pose, pas avant. */}
      {category && (
        <p className="text-xs text-warm-700 -mt-1">
          {SUPPORT_CATEGORIES.find(c => c.value === category)?.aide}
        </p>
      )}

      {/* Champ conditionnel : l'impact ne veut rien dire hors d'un incident,
          et la base le refuse ailleurs. */}
      {estIncident && (
        <>
          <FloatSelect
            label="Impact"
            required
            value={impact}
            onChange={e => setImpact(e.target.value)}
          >
            <option value="" disabled hidden></option>
            {SUPPORT_IMPACTS.map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </FloatSelect>
          {impact && (
            <p className="text-xs text-warm-700 -mt-1">
              {SUPPORT_IMPACTS.find(i => i.value === impact)?.aide}
            </p>
          )}
        </>
      )}

      <FloatInput
        label="Objet"
        required
        value={subject}
        maxLength={SUPPORT_SUBJECT_MAX}
        onChange={e => setSubject(e.target.value)}
        // 1re lettre en majuscule, motif du référentiel des cours.
        onBlur={() => setSubject(v => v ? v.charAt(0).toUpperCase() + v.slice(1) : v)}
      />

      <div>
        <FloatTextarea
          label="Votre message"
          required
          rows={7}
          value={message}
          maxLength={SUPPORT_MESSAGE_MAX}
          onChange={e => setMessage(e.target.value)}
        />
        <p className="text-xs text-warm-700 mt-1">
          {estIncident
            ? "Décrivez ce que vous faisiez, ce que vous attendiez, et ce qui s'est produit."
            : 'Plus votre demande est précise, plus la réponse le sera.'}
        </p>
      </div>

      {/* ── Pièce jointe ─────────────────────────────────────────────────── */}
      <div>
        <input
          ref={inputFichier}
          type="file"
          className="sr-only"
          accept={SUPPORT_ATTACHMENT_TYPES.join(',')}
          onChange={e => choisirFichier(e.target.files?.[0] ?? null)}
        />
        {fichier ? (
          <div className="flex items-center gap-2 text-sm bg-warm-50 border border-warm-200 rounded-lg px-3 py-2">
            <Paperclip size={14} className="text-warm-700 shrink-0" aria-hidden="true" />
            <span className="truncate text-secondary-800 flex-1 min-w-0">{fichier.name}</span>
            <span className="text-xs text-warm-700 shrink-0 tabular-nums">
              {(fichier.size / 1024).toFixed(0)} Ko
            </span>
            <Tooltip content="Retirer la pièce jointe">
              <button
                type="button"
                aria-label="Retirer la pièce jointe"
                onClick={() => {
                  setFichier(null)
                  // Sans cela, resélectionner LE MÊME fichier ne déclenche pas
                  // `change` : la valeur de l'input n'aurait pas varié.
                  if (inputFichier.current) inputFichier.current.value = ''
                }}
                className="p-1 rounded hover:bg-warm-100 text-warm-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X size={14} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputFichier.current?.click()}
            className="text-sm text-primary-700 hover:text-primary-800 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
          >
            Joindre une capture d&apos;écran
          </button>
        )}
        <p className="text-xs text-warm-700 mt-1">
          Facultatif &middot; image ou PDF, 2 Mo maximum. Sur une anomalie, une capture vaut souvent
          mieux qu&apos;une description.
        </p>
      </div>

      {/* ── Contexte transmis ────────────────────────────────────────────── */}
      {/* Replié : il rassure sans encombrer. Ouvert : il ne cache rien. */}
      <div className="border-t border-warm-100 pt-3">
        <button
          type="button"
          onClick={() => setContexteOuvert(o => !o)}
          aria-expanded={contexteOuvert}
          className="text-xs text-warm-700 hover:text-secondary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded"
        >
          {contexteOuvert ? 'Masquer' : 'Voir'} les informations jointes automatiquement
        </button>

        {contexteOuvert && (
          <dl className="mt-2 space-y-1 text-xs">
            {[
              ['École',      ecole ?? 'Non renseignée'],
              ['Auteur',     auteur ? `${auteur.nom} (${auteur.role})` : 'Compte en cours'],
              ['Email',      auteur?.email ?? ''],
              ['Page',       pathname ?? ''],
              ['Version',    APP_VERSION],
            ].map(([cle, val]) => (
              <div key={cle} className="flex gap-2">
                <dt className="text-warm-700 w-20 shrink-0">{cle}</dt>
                <dd className="text-secondary-800 min-w-0 truncate">{val}</dd>
              </div>
            ))}
            <div className="flex gap-2">
              <dt className="text-warm-700 w-20 shrink-0">Navigateur</dt>
              <dd className="text-secondary-800 min-w-0 truncate">
                {typeof navigator !== 'undefined' ? navigator.userAgent : ''}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </FormModal>
  )
}
