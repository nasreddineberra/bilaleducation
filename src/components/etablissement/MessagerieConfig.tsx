'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import {
  saveSmtpSettings,
  testSmtpSettings,
  type SmtpConfigPublic,
  type SaveSmtpPayload,
} from '@/app/dashboard/etablissement/smtp-actions'

interface Props {
  initialConfig: SmtpConfigPublic | null
  /** Contact de l'etablissement : destinataire du test et adresse de reponse. */
  contact: string | null
  /** Nom de l'etablissement : valeur par defaut du nom d'affichage. */
  etablissementNom: string
}

type FormData = {
  host:       string
  port:       string
  secure:     string   // '465' = SMTPS, '587' = STARTTLS → stocke en booleen
  username:   string
  password:   string
  from_name:  string
  from_email: string
}

function toForm(c: SmtpConfigPublic | null, nom: string): FormData {
  return {
    host:       c?.host ?? '',
    port:       c ? String(c.port) : '',
    secure:     c ? (c.secure ? 'ssl' : 'starttls') : '',
    username:   c?.username ?? '',
    password:   '',   // jamais pre-rempli : le serveur ne le renvoie pas
    from_name:  c?.from_name ?? nom,
    from_email: c?.from_email ?? '',
  }
}

export default function MessagerieConfig({ initialConfig, contact, etablissementNom }: Props) {
  const toast = useToast()
  const [config, setConfig] = useState(initialConfig)
  const [form, setForm] = useState<FormData>(() => toForm(initialConfig, etablissementNom))
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const set = (k: keyof FormData, v: string) => {
    setForm(f => ({ ...f, [k]: v }))
    setTestResult(null)
  }

  const isConfigured = !!config
  // Un mot de passe deja enregistre n'a pas a etre ressaisi pour modifier le reste.
  const needsPassword = !config?.hasPassword && !form.password

  const vHost      = !form.host.trim()
  const vUsername  = !form.username.trim()
  const vFromEmail = !form.from_email.trim()
  const vPort      = !form.port.trim()
  const vSecure    = !form.secure

  const incomplete = vHost || vUsername || vFromEmail || vPort || vSecure || needsPassword

  const payload = (): SaveSmtpPayload => ({
    host:       form.host,
    port:       Number(form.port),
    secure:     form.secure === 'ssl',
    username:   form.username,
    password:   form.password,
    from_name:  form.from_name,
    from_email: form.from_email,
  })

  const handleSave = async () => {
    setSaving(true)
    const { error } = await saveSmtpSettings(payload())
    setSaving(false)

    if (error) return toast.error(error)

    toast.success('Messagerie enregistrée.')
    setConfig({
      host:        form.host.trim(),
      port:        Number(form.port),
      secure:      form.secure === 'ssl',
      username:    form.username.trim(),
      from_name:   form.from_name.trim() || null,
      from_email:  form.from_email.trim(),
      hasPassword: true,
    })
    setForm(f => ({ ...f, password: '' }))
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const { error, message } = await testSmtpSettings(payload())
    setTesting(false)
    setTestResult(error ? { ok: false, message: error } : { ok: true, message: message ?? 'Connexion réussie.' })
  }

  return (
    <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Messagerie</h2>
          <span
            role="status"
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              isConfigured ? 'bg-primary-50 text-primary-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isConfigured ? 'Configurée' : 'Non configurée'}
          </span>
        </div>

        {!isConfigured && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            Sans messagerie configurée, <strong>aucun email n'est envoyé</strong> : communications, devoirs, absences.
          </p>
        )}

        {/* Serveur */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-3">
          <FloatInput
            label="Serveur SMTP"
            required
            aria-required="true"
            value={form.host}
            onChange={e => set('host', e.target.value.trim())}
            placeholder="smtp.gmail.com"
          />
          {/* FloatInput n'expose pas wrapperClassName (contrairement a FloatSelect) */}
          <div className="w-24">
            <FloatInput
              label="Port"
              type="number"
              required
              aria-required="true"
              value={form.port}
              onChange={e => set('port', e.target.value)}
            />
          </div>
          <FloatSelect
            label="Chiffrement"
            required
            aria-required="true"
            wrapperClassName="w-40"
            value={form.secure}
            onChange={e => {
              const v = e.target.value
              setForm(f => ({ ...f, secure: v, port: f.port || (v === 'ssl' ? '465' : '587') }))
              setTestResult(null)
            }}
          >
            <option value="" disabled hidden></option>
            <option value="starttls">STARTTLS (587)</option>
            <option value="ssl">SSL/TLS (465)</option>
          </FloatSelect>
        </div>

        {/* Compte */}
        <div className="grid grid-cols-2 gap-3">
          <FloatInput
            label="Identifiant"
            required
            aria-required="true"
            value={form.username}
            onChange={e => set('username', e.target.value.trim())}
            autoComplete="off"
          />

          <div className="relative">
            <FloatInput
              label={config?.hasPassword ? 'Mot de passe (inchangé si vide)' : "Mot de passe d'application"}
              type={showPassword ? 'text' : 'password'}
              required={!config?.hasPassword}
              aria-required={!config?.hasPassword}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              onMouseDown={e => e.preventDefault()}
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-warm-400 hover:text-warm-600 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <p className="text-xs text-warm-400">
          Gmail : identifiant = adresse complète, et <strong>mot de passe d'application</strong> (2FA requise).
          Le mot de passe enregistré n'est jamais réaffiché.
        </p>

        {/* Expediteur */}
        <div className="grid grid-cols-2 gap-3">
          <FloatInput
            label="Nom affiché"
            value={form.from_name}
            onChange={e => set('from_name', e.target.value)}
          />
          <FloatInput
            label="Adresse d'expédition"
            type="email"
            required
            aria-required="true"
            value={form.from_email}
            onChange={e => set('from_email', e.target.value.trim())}
          />
        </div>

        <p className="text-xs text-warm-400">
          L'adresse d'expédition doit être celle du compte, sinon les messages partent en indésirable.
          {contact
            ? <> Les familles répondront à <strong>{contact}</strong>.</>
            : <> Renseignez l'email de contact ci-dessus : sans lui, aucune communication ne peut partir.</>}
        </p>

        {testResult && (
          <p
            role="alert"
            className={`text-xs rounded-lg px-3 py-2 border ${
              testResult.ok
                ? 'text-primary-700 bg-primary-50 border-primary-200'
                : 'text-red-600 bg-red-50 border-red-200'
            }`}
          >
            {testResult.message}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <FloatButton
            type="button"
            variant="secondary"
            onClick={handleTest}
            disabled={incomplete || testing || saving}
            loading={testing}
          >
            Tester la connexion
          </FloatButton>
          <FloatButton
            type="button"
            variant={isConfigured ? 'edit' : 'submit'}
            onClick={handleSave}
            disabled={incomplete || saving || testing}
            loading={saving}
          >
            Enregistrer
          </FloatButton>
        </div>
    </div>
  )
}
