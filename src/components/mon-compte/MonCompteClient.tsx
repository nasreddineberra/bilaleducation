'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { createClient } from '@/lib/supabase/client'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { PASSWORD_RULES, isPasswordValid } from '@/lib/validation/password'
import { updateOwnProfile, updateOwnEmail } from '@/app/dashboard/mon-compte/actions'
import TwoFactorCard from '@/components/mon-compte/TwoFactorCard'

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

interface ProfileData {
  id:               string
  email:            string
  role:             string
  civilite:         string | null
  first_name:       string
  last_name:        string
  phone:            string | null
  etablissement_id: string | null
}

interface Props {
  profile:            ProfileData
  email:              string
  etablissementName:  string
}

const CIVILITE_OPTIONS = ['M.', 'Mme']

const ROLE_LABELS: Record<string, string> = {
  super_admin:              'Super administrateur',
  admin:                    'Administrateur',
  direction:                'Direction',
  comptable:                'Comptable',
  responsable_pedagogique:  'Responsable pédagogique',
  enseignant:               'Enseignant',
  secretaire:               'Secrétaire',
  parent:                   'Parent',
}

export default function MonCompteClient({ profile, email, etablissementName }: Props) {
  const router = useRouter()
  const toast  = useToast()

  const initial = {
    civilite:   profile.civilite   ?? '',
    first_name: profile.first_name ?? '',
    last_name:  profile.last_name  ?? '',
    phone:      profile.phone      ?? '',
  }
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  // ── Email (changement direct réservé admin/direction) ──
  const canEditEmail = profile.role === 'admin' || profile.role === 'direction'
  const [emailInput,   setEmailInput]   = useState(email)
  const [confirmEmail, setConfirmEmail] = useState(false)
  const [emailSaving,  setEmailSaving]  = useState(false)
  const emailChanged = emailInput.trim() !== email && isValidEmail(emailInput.trim())

  const handleChangeEmail = async () => {
    setEmailSaving(true)
    const { error } = await updateOwnEmail(emailInput.trim())
    setEmailSaving(false)
    setConfirmEmail(false)
    if (error) { toast.error(error); return }
    toast.success('Adresse email mise à jour.')
    router.refresh()
  }

  // ── Mot de passe ──
  const [newPw,     setNewPw]     = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [pwSaving,  setPwSaving]  = useState(false)

  const pwValid = isPasswordValid(newPw, profile.first_name, profile.last_name)
  const pwMatch = newPw.length > 0 && newPw === confirmPw

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwValid || !pwMatch || pwSaving) return
    setPwSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwSaving(false)
    if (error) {
      toast.error(error.message.includes('should be different')
        ? 'Le nouveau mot de passe doit être différent de l\'ancien.'
        : 'Erreur lors du changement de mot de passe.')
      return
    }
    toast.success('Mot de passe modifié avec succès.')
    setNewPw(''); setConfirmPw(''); setShowPw(false)
  }

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const unchanged =
    form.civilite === initial.civilite &&
    form.first_name === initial.first_name &&
    form.last_name === initial.last_name &&
    form.phone === initial.phone
  const invalid = !form.first_name.trim() || !form.last_name.trim()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (invalid || unchanged || saving) return
    setSaving(true)
    const { error } = await updateOwnProfile({
      civilite:   form.civilite || null,
      first_name: form.first_name,
      last_name:  form.last_name,
      phone:      form.phone.trim() || null,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Profil mis à jour avec succès.')
    router.refresh()
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-2xl">

      {/* ── Mes informations (éditable) ── */}
      <form onSubmit={handleSave} noValidate className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Mes informations</h2>

        <div className="grid grid-cols-[6rem_1fr_1fr] gap-3">
          <FloatSelect label="Civilité" value={form.civilite} onChange={e => set('civilite', e.target.value)}>
            <option value="" disabled hidden></option>
            {CIVILITE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </FloatSelect>
          <FloatInput label="Prénom" required value={form.first_name} onChange={e => set('first_name', e.target.value)} />
          <FloatInput label="Nom" required value={form.last_name} onChange={e => set('last_name', e.target.value)} />
        </div>

        <FloatInput label="Téléphone" value={form.phone} onChange={e => set('phone', e.target.value)} />

        <div className="flex items-center gap-3 pt-1">
          <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
          <div className="flex-1" />
          <FloatButton type="submit" variant="edit" disabled={saving || invalid || unchanged} loading={saving}>
            Enregistrer
          </FloatButton>
        </div>
      </form>

      {/* ── Compte ── */}
      <div className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Compte</h2>
        <div className="grid grid-cols-2 gap-3">
          {canEditEmail ? (
            <FloatInput
              label="Adresse email"
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              error={emailInput.trim().length > 0 && !isValidEmail(emailInput.trim()) ? 'Adresse email invalide.' : undefined}
            />
          ) : (
            <FloatInput label="Adresse email" value={email} locked onChange={() => {}} />
          )}
          <FloatInput label="Rôle" value={ROLE_LABELS[profile.role] ?? profile.role} locked onChange={() => {}} />
        </div>
        {etablissementName && (
          <FloatInput label="Établissement" value={etablissementName} locked onChange={() => {}} />
        )}
        {canEditEmail ? (
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-warm-400">Le rôle et l&apos;établissement ne sont pas modifiables.</p>
            <div className="flex-1" />
            <FloatButton type="button" variant="edit" disabled={!emailChanged || emailSaving} onClick={() => setConfirmEmail(true)}>
              Changer l&apos;email
            </FloatButton>
          </div>
        ) : (
          <p className="text-[11px] text-warm-400">
            Pour changer d&apos;adresse email, de rôle ou d&apos;établissement, contactez un administrateur.
          </p>
        )}
      </div>

      {/* ── Mot de passe ── */}
      <form onSubmit={changePassword} noValidate className="card p-4 space-y-3">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Mot de passe</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <FloatInput
              label="Nouveau mot de passe"
              type={showPw ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPw}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-secondary-600 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 z-10"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <FloatInput
            label="Confirmer"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            error={confirmPw.length > 0 && !pwMatch ? 'Les mots de passe ne correspondent pas.' : undefined}
          />
        </div>

        {/* Règles */}
        {newPw.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1" aria-label="Règles du mot de passe">
            {PASSWORD_RULES.map(rule => {
              const ok = rule.test(newPw, profile.first_name, profile.last_name)
              return (
                <li key={rule.key} className={`flex items-center gap-1.5 text-[11px] ${ok ? 'text-emerald-600' : 'text-warm-400'}`}>
                  {ok ? <Check size={12} className="flex-shrink-0" /> : <X size={12} className="flex-shrink-0" />}
                  {rule.label}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <FloatButton type="submit" variant="edit" disabled={pwSaving || !pwValid || !pwMatch} loading={pwSaving}>
            Changer le mot de passe
          </FloatButton>
        </div>
      </form>

      {/* ── Double authentification (hors rôle parent) ── */}
      {profile.role !== 'parent' && <TwoFactorCard />}

      {confirmEmail && (
        <ConfirmModal
          title="Confirmer le changement d'email ?"
          message={`Votre adresse de connexion passera de « ${email} » à « ${emailInput.trim()} ». Vous vous connecterez ensuite avec cette nouvelle adresse.`}
          confirmLabel={emailSaving ? 'Changement…' : 'Confirmer'}
          confirmColor="amber"
          confirmDisabled={emailSaving}
          onConfirm={handleChangeEmail}
          onCancel={() => setConfirmEmail(false)}
        />
      )}

    </div>
  )
}
