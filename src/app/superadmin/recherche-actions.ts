'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireEditor } from '@/lib/auth/requireEditor'

export interface CompteRecherche {
  id:           string
  nom:          string
  prenom:       string
  email:        string
  role:         string
  actif:        boolean
  ecoleId:      string
  ecoleNom:     string
}

const MIN = 2
const MAX_RESULTATS = 8

// Insensible aux accents et a la casse (meme regle que la recherche des ecoles).
const norm = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Recherche des COMPTES pour la barre de la console (23/10) : nom, prenom ou
 * email, toutes ecoles. Appelee a la frappe, et non chargee avec la page : la
 * liste complete mettrait les noms et emails de tous les utilisateurs dans le
 * HTML de chaque ecran. Ne rend que ce qui s'affiche, 8 comptes au plus.
 *
 * Ni parents ni comptes editeur : la destination est la section Utilisateurs
 * de la fiche ecole, qui ne montre que le personnel.
 *
 * Service-role (lecture de toutes les ecoles) : garde `requireEditor`.
 */
export async function rechercherComptes(q: string): Promise<{ comptes: CompteRecherche[]; error?: string }> {
  const { error } = await requireEditor()
  if (error) return { comptes: [], error }

  const n = norm((q ?? '').trim())
  if (n.length < MIN) return { comptes: [] }

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, first_name, last_name, email, role, is_active, etablissement_id, etablissements(nom)')
    .not('role', 'in', '(parent,super_admin)')
    .not('etablissement_id', 'is', null)

  const comptes = (data ?? [])
    .filter(p => [p.last_name, p.first_name, p.email].some(v => norm(v ?? '').includes(n))
      || norm(`${p.last_name ?? ''} ${p.first_name ?? ''}`).includes(n)
      || norm(`${p.first_name ?? ''} ${p.last_name ?? ''}`).includes(n))
    // Actifs d'abord, puis NOM Prenom.
    .sort((a, b) => Number(b.is_active) - Number(a.is_active)
      || `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'fr'))
    .slice(0, MAX_RESULTATS)
    .map(p => ({
      id:       p.id,
      nom:      p.last_name ?? '',
      prenom:   p.first_name ?? '',
      email:    p.email ?? '',
      role:     p.role,
      actif:    Boolean(p.is_active),
      ecoleId:  p.etablissement_id as string,
      ecoleNom: (p.etablissements as unknown as { nom: string } | null)?.nom ?? '',
    }))

  return { comptes }
}
