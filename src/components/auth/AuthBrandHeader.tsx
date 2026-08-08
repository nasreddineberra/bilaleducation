'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

/**
 * En-tête des écrans d'authentification : le logo et le nom de L'ÉCOLE.
 *
 * ┌─ CE QU'IL REMPLACE ─────────────────────────────────────────────────────┐
 * │ Une pastille « B » et le nom « Bilal Education », recopiés dans six      │
 * │ écrans sur sept. Or ces pages vivent sur le sous-domaine d'un            │
 * │ établissement : le middleware l'a résolu, la route publique le renvoie.  │
 * │ L'utilisateur qui définit son mot de passe se connecte chez SON école,   │
 * │ pas chez l'éditeur — c'est elle qu'il doit reconnaître.                  │
 * │                                                                          │
 * │ Le commentaire du pied de page l'énonçait déjà : « le haut de page       │
 * │ appartient à l'établissement, l'application se signe en bas ». L'intention│
 * │ était écrite ; l'en-tête ne la respectait pas.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La carte blanche derrière le logo n'est pas décorative : un logo est dessiné
 * pour un fond clair, et le fond de marque est un teal profond. Même décision
 * que pour l'icône des emails et la fiche établissement (3 août).
 */
export default function AuthBrandHeader({
  sousTitre = 'Espace de gestion',
}: {
  sousTitre?: string
}) {
  const [nomEtab, setNomEtab] = useState('Bilal Education')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/public/etablissement')
      .then(r => r.json())
      .then(d => {
        if (d.nom) setNomEtab(d.nom)
        if (d.logo_url) setLogoUrl(d.logo_url)
      })
      .catch(err => console.error('[AuthBrandHeader] infos établissement:', err))
  }, [])

  // Repli quand l'école n'a pas de logo : ses initiales. `length > 1` écarte
  // les articles (« de », « la »), qui n'apprennent rien.
  const initiales = nomEtab
    .split(' ')
    .filter(w => w.length > 1)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')

  return (
    <div className="flex flex-col items-center mb-8">
      <div className="mb-4 inline-flex items-center justify-center bg-white rounded-2xl p-4 shadow-lg">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={nomEtab}
            width={128}
            height={128}
            className="h-32 w-auto object-contain"
            unoptimized
          />
        ) : (
          <div className="w-32 h-32 rounded-xl flex items-center justify-center font-bold text-4xl text-primary-600 select-none">
            {initiales || 'BE'}
          </div>
        )}
      </div>
      <h1 className="text-xl font-bold text-white tracking-tight">{nomEtab}</h1>
      <p className="text-white/75 mt-0.5 text-sm">{sousTitre}</p>
    </div>
  )
}
