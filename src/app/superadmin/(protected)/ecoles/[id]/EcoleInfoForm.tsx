'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { updateEtablissement, toggleEtablissementActive, updateSubscription, updateMaxStudents } from '@/app/superadmin/actions'
import { enregistrerFacturation } from '@/app/superadmin/facturation-actions'
import type { FacturationEcole } from '@/lib/tenant/facturation'
import type { Etablissement } from '@/types/database'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { FloatInput, FloatTextarea, FloatButton } from '@/components/ui/FloatFields'
import { ETAB_NOM_MAX, ETAB_ADRESSE_MAX } from '@/lib/tenant/limites'

const isValidEmail = (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

/** Montant saisi -> nombre, vide -> null, illisible -> NaN (refuse a la validation). */
const lireMontant = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

/** Compteur de saisie DANS le champ (motif de la fiche etablissement). */
function Compteur({ n, max }: { n: number; max: number }) {
  return (
    <span aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-warm-700 tabular-nums pointer-events-none">
      {n}/{max}
    </span>
  )
}

/**
 * Fiche ecole de la console. TOUS LES CHAMPS EN TAILLE COMPACTE (charte :
 * `FloatInput compact`, `FloatButton size="mini"`) : la fiche doit tenir sur une
 * page sans barre de defilement, Notes (7 lignes) et facturation comprises.
 */
export default function EcoleInfoForm({ ecole, notes, facturation }: {
  ecole: Etablissement
  notes: string
  facturation: FacturationEcole | null
}) {
  type FormData = {
    nom: string; adresse: string; telephone: string; contact: string; notes: string
    structure: string; identifiant: string; adresseFact: string; responsable: string; email: string
    prixInscrit: string; forfait: string
  }
  const montantTexte = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

  const [form, setForm] = useState<FormData>({
    nom:         ecole.nom       ?? '',
    adresse:     ecole.adresse   ?? '',
    telephone:   ecole.telephone ?? '',
    contact:     ecole.contact   ?? '',
    notes,
    structure:   facturation?.structure   ?? '',
    identifiant: facturation?.identifiant ?? '',
    adresseFact: facturation?.adresse     ?? '',
    responsable: facturation?.responsable ?? '',
    email:       facturation?.email       ?? '',
    prixInscrit: montantTexte(facturation?.prix_inscrit),
    forfait:     montantTexte(facturation?.forfait),
  })
  const [subExpiry,    setSubExpiry]    = useState(ecole.subscription_expires_at ? ecole.subscription_expires_at.split('T')[0] : '')
  const [maxStudents,  setMaxStudents]  = useState(ecole.max_students != null ? String(ecole.max_students) : '')
  const initialForm    = useRef<FormData>({ ...form })
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toggling,     setToggling]     = useState(false)
  const [savingDate,   setSavingDate]   = useState(false)
  const [savingMax,    setSavingMax]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)

  // Trois actions lourdes s'executaient sur un simple clic : couper l'acces d'une
  // ecole entiere, retirer l'echeance d'abonnement, retirer la limite d'eleves.
  const [aConfirmer, setAConfirmer] = useState<null | 'acces' | 'abonnement' | 'limite'>(null)
  const [message,    setMessage]    = useState<string | null>(null)
  const router = useRouter()

  const set   = (f: keyof FormData, v: string) => setForm(p => ({ ...p, [f]: v }))
  const touch = (f: string) => setTouched(p => new Set([...p, f]))
  const vu    = (f: string) => touched.has(f)

  const vNom     = form.nom.trim().length < 2
  // Adresse de reponse (Reply-To) de tous les envois de l'ecole.
  const vContact = !isValidEmail(form.contact)
  const vEmail   = !isValidEmail(form.email)
  const prix     = lireMontant(form.prixInscrit)
  const forfait  = lireMontant(form.forfait)
  const vPrix    = prix !== null && (!Number.isFinite(prix) || prix < 0)
  const vForfait = forfait !== null && (!Number.isFinite(forfait) || forfait < 0)
  const isValid  = !vNom && !vContact && !vEmail && !vPrix && !vForfait

  const change = (cles: (keyof FormData)[]) => cles.some(k => form[k] !== initialForm.current[k])
  const infoChange = change(['nom', 'adresse', 'telephone', 'contact', 'notes'])
  const factChange = change(['structure', 'identifiant', 'adresseFact', 'responsable', 'email', 'prixInscrit', 'forfait'])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set(Object.keys(form)))
    setError(null); setSuccess(false)
    if (!isValid) return
    setIsSubmitting(true)
    try {
      if (infoChange) {
        const r = await updateEtablissement(ecole.id, {
          nom:       form.nom.trim(),
          adresse:   form.adresse.trim()   || undefined,
          telephone: form.telephone.trim() || undefined,
          contact:   form.contact.trim()   || undefined,
          notes:     form.notes.trim()     || null,
        })
        if (r.error) { setError(r.error); return }
      }
      if (factChange) {
        const r = await enregistrerFacturation(ecole.id, {
          structure:    form.structure.trim()   || null,
          identifiant:  form.identifiant.trim() || null,
          adresse:      form.adresseFact.trim() || null,
          responsable:  form.responsable.trim() || null,
          email:        form.email.trim()       || null,
          prix_inscrit: prix,
          forfait,
        })
        if (r.error) { setError(r.error); return }
      }
      initialForm.current = { ...form }
      setSuccess(true)
      router.refresh()
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /** Exécute une action, affiche son refus s'il y en a un, et rafraîchit l'écran. */
  const agir = async (
    marqueur: (v: boolean) => void,
    action: () => Promise<{ error?: string }>,
    confirmation: string,
  ) => {
    marqueur(true)
    setError(null); setSuccess(false)
    try {
      const res = await action()
      if (res?.error) { setError(res.error); return }
      setMessage(confirmation)
      router.refresh()
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      marqueur(false)
    }
  }

  const handleToggle = () =>
    agir(setToggling,
      () => toggleEtablissementActive(ecole.id, !ecole.is_active),
      ecole.is_active ? 'Accès coupé.' : 'Accès rétabli.')

  const handleSaveDate = () =>
    agir(setSavingDate,
      () => updateSubscription(ecole.id, subExpiry || null),
      subExpiry ? 'Échéance enregistrée.' : 'Échéance retirée.')

  const handleSaveMax = () =>
    agir(setSavingMax,
      () => updateMaxStudents(ecole.id, maxStudents.trim() ? parseInt(maxStudents, 10) : null),
      maxStudents.trim() ? 'Limite enregistrée.' : 'Limite retirée.')

  const titre = 'text-xs font-bold text-warm-700 uppercase tracking-widest'

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} noValidate>
        <div className="card p-3 space-y-2">
          <h2 className={titre}>Informations</h2>

          <div className="relative">
            <FloatInput compact required label="Nom" maxLength={ETAB_NOM_MAX} value={form.nom}
              onChange={e => set('nom', e.target.value.toUpperCase())} onBlur={() => touch('nom')}
              error={vu('nom') && vNom ? 'Obligatoire.' : undefined} className="pr-12" />
            <Compteur n={form.nom.length} max={ETAB_NOM_MAX} />
          </div>
          <div className="relative">
            <FloatInput compact label="Adresse" maxLength={ETAB_ADRESSE_MAX} value={form.adresse}
              onChange={e => set('adresse', e.target.value)} className="pr-12" />
            <Compteur n={form.adresse.length} max={ETAB_ADRESSE_MAX} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FloatInput compact label="Téléphone" type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} />
            <FloatInput compact label="Email contact" type="email" value={form.contact}
              onChange={e => set('contact', e.target.value)} onBlur={() => touch('contact')}
              error={vu('contact') && vContact ? 'Adresse invalide.' : undefined} />
          </div>
          <FloatTextarea label="Notes internes" rows={7} value={form.notes}
            onChange={e => set('notes', e.target.value)} className="resize-none text-xs" />

          <h3 className={`${titre} pt-1`}>Facturation</h3>
          <div className="grid grid-cols-2 gap-2">
            <FloatInput compact label="Structure" value={form.structure} onChange={e => set('structure', e.target.value)} />
            <FloatInput compact label="SIRET / RNA" value={form.identifiant} onChange={e => set('identifiant', e.target.value)} />
          </div>
          <FloatInput compact label="Adresse de facturation" value={form.adresseFact} onChange={e => set('adresseFact', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <FloatInput compact label="Responsable" value={form.responsable} onChange={e => set('responsable', e.target.value)} />
            <FloatInput compact label="Email facturation" type="email" value={form.email}
              onChange={e => set('email', e.target.value)} onBlur={() => touch('email')}
              error={vu('email') && vEmail ? 'Adresse invalide.' : undefined} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FloatInput compact label="Prix par inscrit (€)" inputMode="decimal" value={form.prixInscrit}
              onChange={e => set('prixInscrit', e.target.value)} onBlur={() => touch('prixInscrit')}
              error={vu('prixInscrit') && vPrix ? 'Montant invalide.' : undefined} />
            <FloatInput compact label="Forfait mensuel (€)" inputMode="decimal" value={form.forfait}
              onChange={e => set('forfait', e.target.value)} onBlur={() => touch('forfait')}
              error={vu('forfait') && vForfait ? 'Montant invalide.' : undefined} />
          </div>

          {error   && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">{error}</p>}
          {success && <p role="status" className="flex items-center gap-2 text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-3 py-1.5"><CheckCircle2 size={13} /> Enregistré.</p>}

          <div className="flex items-center gap-3">
            <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
            <div className="flex-1" />
            <FloatButton type="submit" size="mini" variant="submit" loading={isSubmitting}
              disabled={isSubmitting || !isValid || (!infoChange && !factChange)}>
              Enregistrer
            </FloatButton>
          </div>
        </div>
      </form>

      <div className="card p-3 space-y-2">
        <h2 className={titre}>Accès et abonnement</h2>

        {message && (
          <p role="status" className="flex items-center gap-2 text-xs text-primary-700 bg-primary-50 border border-primary-200 rounded-lg px-3 py-1">
            <CheckCircle2 size={13} className="shrink-0" /> {message}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-secondary-700">
            <span className="font-medium">Statut d&apos;accès</span>
            <span className="text-warm-700"> · {ecole.is_active ? "l'école peut se connecter" : "accès bloqué"}</span>
          </p>
          <FloatButton type="button" size="mini" variant={ecole.is_active ? 'danger' : 'submit'} loading={toggling}
            onClick={() => (ecole.is_active ? setAConfirmer('acces') : handleToggle())}>
            {ecole.is_active ? 'Désactiver' : 'Activer'}
          </FloatButton>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <FloatInput compact label="Expiration" type="date" value={subExpiry} onChange={e => setSubExpiry(e.target.value)} />
          </div>
          <FloatButton type="button" size="mini" variant="secondary" loading={savingDate} onClick={handleSaveDate}>Enregistrer</FloatButton>
          {subExpiry && (
            <FloatButton type="button" size="mini" variant="secondary" onClick={() => setAConfirmer('abonnement')}>Aucune</FloatButton>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {/* Vide = illimite. */}
            <FloatInput compact label="Limite d'élèves (vide = illimitée)" type="number" min={1}
              value={maxStudents} onChange={e => setMaxStudents(e.target.value)} />
          </div>
          <FloatButton type="button" size="mini" variant="secondary" loading={savingMax} onClick={handleSaveMax}>Enregistrer</FloatButton>
          {maxStudents && (
            <FloatButton type="button" size="mini" variant="secondary" onClick={() => setAConfirmer('limite')}>Aucune</FloatButton>
          )}
        </div>
      </div>

      {aConfirmer === 'acces' && (
        <ConfirmModal
          title="Couper l'accès de cet établissement ?"
          message={`Plus personne de « ${ecole.nom} » ne pourra se connecter, ni la direction, ni les enseignants, ni le secrétariat. Les données sont conservées et l'accès se rétablit d'un clic.`}
          confirmLabel="Désactiver"
          variant="danger"
          onConfirm={() => { setAConfirmer(null); handleToggle() }}
          onCancel={() => setAConfirmer(null)}
        />
      )}

      {aConfirmer === 'abonnement' && (
        <ConfirmModal
          title="Retirer l'échéance d'abonnement ?"
          message="L'établissement n'aura plus de date d'expiration : son accès ne se coupera jamais de lui-même."
          confirmLabel="Retirer l'échéance"
          onConfirm={() => {
            setAConfirmer(null)
            setSubExpiry('')
            agir(setSavingDate, () => updateSubscription(ecole.id, null), 'Échéance retirée.')
          }}
          onCancel={() => setAConfirmer(null)}
        />
      )}

      {aConfirmer === 'limite' && (
        <ConfirmModal
          title="Retirer la limite d'élèves ?"
          message="L'établissement pourra inscrire un nombre illimité d'élèves."
          confirmLabel="Retirer la limite"
          onConfirm={() => {
            setAConfirmer(null)
            setMaxStudents('')
            agir(setSavingMax, () => updateMaxStudents(ecole.id, null), 'Limite retirée.')
          }}
          onCancel={() => setAConfirmer(null)}
        />
      )}
    </div>
  )
}
