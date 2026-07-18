'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import Image from 'next/image'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { revalidateEtablissement } from '@/app/dashboard/etablissement/actions'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import type { Etablissement } from '@/types/database'

interface EtablissementFormProps {
  etablissement: Etablissement
}

type FormData = {
  nom:       string
  adresse:   string
  telephone: string
  contact:   string
}

const toUpperCase  = (v: string) => v.toUpperCase()
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = new window.Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload  = () => resolve()
    image.onerror = reject
    image.src     = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width  = 300
  canvas.height = 300
  canvas.getContext('2d')!.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, 300, 300
  )
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas vide')), 'image/png')
  })
}

export default function EtablissementForm({ etablissement }: EtablissementFormProps) {
  const router = useRouter()
  const toast  = useToast()

  const [form, setForm] = useState<FormData>({
    nom:       etablissement.nom       ?? '',
    adresse:   etablissement.adresse   ?? '',
    telephone: etablissement.telephone ?? '',
    contact:   etablissement.contact   ?? '',
  })

  const initialForm    = useRef<FormData>({ ...form })
  const [touched,      setTouched]      = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Logo
  const [logoUrl,      setLogoUrl]      = useState<string | null>(etablissement.logo_url ?? null)
  const initialLogoUrl = useRef<string | null>(etablissement.logo_url ?? null)

  // Premier jour de la semaine
  const [weekStartDay, setWeekStartDay] = useState<number>(etablissement.week_start_day ?? -1)
  const initialWeekStartDay = useRef<number>(etablissement.week_start_day ?? -1)

  // Jours travailles (5 ou 7)
  const [workingDays, setWorkingDays] = useState<number>(etablissement.working_days ?? 5)
  const initialWorkingDays = useRef<number>(etablissement.working_days ?? 5)

  const set = (field: keyof FormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))
  const touch = (field: string) =>
    setTouched(prev => new Set([...prev, field]))

  // Validation
  const vNom          = form.nom.trim().length < 2
  const vContact      = form.contact.trim().length > 0 && !isValidEmail(form.contact.trim())
  const vWeekStartDay = weekStartDay === -1
  const isValid       = !vNom && !vContact && !vWeekStartDay

  // Bouton désactivé si aucun changement
  const isUnchanged = (Object.keys(form) as (keyof FormData)[]).every(
    k => form[k] === initialForm.current[k]
  ) && logoUrl === initialLogoUrl.current && weekStartDay === initialWeekStartDay.current && workingDays === initialWorkingDays.current

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(new Set([...Object.keys(form), 'weekStartDay']))

    if (!isValid) return

    setIsSubmitting(true)
    try {
      const payload = {
        nom:            form.nom.trim(),
        adresse:        form.adresse.trim()   || null,
        telephone:      form.telephone.trim() || null,
        contact:        form.contact.trim()   || null,
        logo_url:       logoUrl,
        week_start_day: weekStartDay,
        working_days:   workingDays,
      }

      const supabase = createClient()
      const { error } = await supabase
        .from('etablissements')
        .update(payload)
        .eq('id', etablissement.id)
      if (error) throw error

      initialForm.current         = { ...form }
      initialLogoUrl.current      = logoUrl
      initialWeekStartDay.current = weekStartDay
      initialWorkingDays.current  = workingDays
      await revalidateEtablissement()
      toast.success('Informations enregistrées avec succès.')
      router.refresh()
    } catch {
      toast.error('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">

      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        <div className="card p-5">
          <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest mb-3">Identité</h2>

          <div className="flex gap-6">

            {/* Gauche : Logo 160×160 + boutons */}
            <LogoField
              logoUrl={logoUrl}
              etablissementId={etablissement.id}
              onChange={setLogoUrl}
            />

            {/* Droite : Champs */}
            <div className="flex-1 space-y-3 min-w-0">
              <FloatInput
                label="Nom de l'établissement"
                required
                aria-required="true"
                value={form.nom}
                onChange={e => set('nom', toUpperCase(e.target.value))}
                onBlur={() => touch('nom')}
                error={touched.has('nom') && vNom ? 'Le nom est obligatoire (2 caractères minimum).' : undefined}
              />

              <FloatInput
                label="Adresse"
                value={form.adresse}
                onChange={e => set('adresse', e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <FloatInput
                  label="Téléphone"
                  type="tel"
                  value={form.telephone}
                  onChange={e => set('telephone', e.target.value)}
                />

                <FloatInput
                  label="Email de contact"
                  type="email"
                  value={form.contact}
                  onChange={e => set('contact', e.target.value)}
                  onBlur={() => touch('contact')}
                  error={touched.has('contact') && vContact ? 'Adresse email invalide.' : undefined}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FloatSelect
                  label="Premier jour de la semaine"
                  required
                  aria-required="true"
                  value={weekStartDay === -1 ? '' : String(weekStartDay)}
                  onChange={e => setWeekStartDay(e.target.value === '' ? -1 : Number(e.target.value))}
                  onBlur={() => touch('weekStartDay')}
                  error={touched.has('weekStartDay') && weekStartDay === -1 ? 'Obligatoire.' : undefined}
                >
                  <option value="" disabled hidden></option>
                  <option value="1">Lundi</option>
                  <option value="6">Samedi</option>
                  <option value="0">Dimanche</option>
                </FloatSelect>

                <FloatSelect
                  label="Jours travaillés"
                  required
                  aria-required="true"
                  value={String(workingDays)}
                  onChange={e => setWorkingDays(Number(e.target.value))}
                >
                  <option value="5">Semaine de 5 jours</option>
                  <option value="7">Semaine de 7 jours</option>
                </FloatSelect>
              </div>
            </div>

          </div>

          {/* Actions dans l'encadre (la mention « * obligatoire » est commune aux
              deux encadres et vit sous la colonne, dans la page) */}
          <div className="flex items-center justify-end mt-4">
            <FloatButton
              type="submit"
              variant="submit"
              disabled={isSubmitting || !isValid || isUnchanged}
            >
              {isSubmitting ? 'Enregistrement...' : 'Valider'}
            </FloatButton>
          </div>
        </div>

      </form>

    </div>
  )
}

// ─── Logo upload ──────────────────────────────────────────────────────────────

function LogoField({
  logoUrl, etablissementId, onChange,
}: {
  logoUrl: string | null
  etablissementId: string
  onChange: (url: string | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef    = useRef<HTMLDivElement>(null)

  const [cropSrc,           setCropSrc]           = useState<string | null>(null)
  const [crop,              setCrop]              = useState({ x: 0, y: 0 })
  const [zoom,              setZoom]              = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isUploading,       setIsUploading]       = useState(false)
  const [uploadError,       setUploadError]       = useState<string | null>(null)
  const [confirmDelete,     setConfirmDelete]     = useState(false)

  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  // Modale recadrage : focus + fermeture Échap
  useEffect(() => {
    if (!cropSrc) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isUploading) closeCrop() }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropSrc, isUploading])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    e.target.value = ''
  }

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return
    setUploadError(null)
    setIsUploading(true)
    try {
      const blob = await getCroppedImg(cropSrc, croppedAreaPixels)
      if (blob.size > 1_048_576) {
        setUploadError('Logo trop grand après compression (> 1 Mo). Essayez une autre image.')
        return
      }
      const supabase = createClient()
      const path = `${etablissementId}/logo.png`
      const { error } = await supabase.storage
        .from('etablissement-logos')
        .upload(path, blob, { upsert: true, contentType: 'image/png' })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('etablissement-logos').getPublicUrl(path)
      onChange(`${publicUrl}?t=${Date.now()}`)
      closeCrop()
    } catch (err: any) {
      setUploadError(err?.message ?? "Erreur lors de l'upload. Veuillez réessayer.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async () => {
    setUploadError(null)
    setIsUploading(true)
    try {
      const supabase = createClient()
      await supabase.storage.from('etablissement-logos').remove([`${etablissementId}/logo.png`])
      onChange(null)
    } catch {
      setUploadError('Erreur lors de la suppression.')
    } finally {
      setIsUploading(false)
    }
  }

  const linkCls = 'text-xs font-medium rounded px-1 transition-colors disabled:opacity-40 outline-none focus-visible:ring-2'

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      {/* Aperçu 160×160 */}
      <div className="w-40 h-40 rounded-xl border border-warm-200 bg-white flex items-center justify-center overflow-hidden">
        {logoUrl
          ? <Image src={logoUrl} alt="Logo de l'établissement" width={160} height={160} className="w-full h-full object-contain p-2" unoptimized />
          : <span className="text-xs text-warm-700 text-center px-2">Aucun logo</span>
        }
      </div>

      {/* Liens sous le logo */}
      <div className="flex flex-col gap-1 items-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`${linkCls} text-primary-700 hover:text-primary-800 focus-visible:ring-primary-500/50`}
        >
          {logoUrl ? 'Changer' : 'Importer'}
        </button>
        {logoUrl && !confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isUploading}
            className={`${linkCls} text-red-500 hover:text-red-700 focus-visible:ring-red-500/50`}
          >
            Supprimer
          </button>
        )}
        {confirmDelete && (
          <div className="flex flex-col gap-1 items-center">
            <button
              type="button"
              onClick={() => { setConfirmDelete(false); handleDelete() }}
              disabled={isUploading}
              className={`${linkCls} font-semibold text-red-600 hover:text-red-800 focus-visible:ring-red-500/50`}
            >
              Confirmer ?
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className={`${linkCls} text-warm-700 hover:text-warm-700 focus-visible:ring-warm-400/50`}
            >
              Annuler
            </button>
          </div>
        )}
        {uploadError && <p role="alert" className="text-[10px] text-red-500 text-center">{uploadError}</p>}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Modale recadrage */}
      {cropSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !isUploading && closeCrop()}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-title"
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden outline-none"
          >
            <div className="px-4 py-3 border-b border-warm-100 flex items-center justify-between">
              <h3 id="crop-title" className="text-sm font-bold text-secondary-800">Recadrer le logo</h3>
              <button
                type="button"
                onClick={closeCrop}
                aria-label="Fermer"
                className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                <X size={16} />
              </button>
            </div>
            <div className="relative w-full" style={{ height: 320 }}>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
              />
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              <label className="flex items-center gap-2 text-xs text-warm-700">
                <span className="whitespace-nowrap">Zoom</span>
                <input
                  type="range"
                  min={1} max={3} step={0.05}
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                  aria-label="Zoom du logo"
                  className="w-full accent-amber-500"
                />
              </label>
              <div className="flex justify-end gap-2">
                <FloatButton type="button" variant="secondary" onClick={closeCrop} className="!py-1.5 !px-3">
                  Annuler
                </FloatButton>
                <FloatButton type="button" variant="submit" onClick={handleCropConfirm} disabled={isUploading} className="!py-1.5 !px-3">
                  {isUploading ? 'Envoi…' : 'Valider'}
                </FloatButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
