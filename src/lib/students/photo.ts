import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Photos d'eleves (bucket PRIVE depuis le 27/10, `secure-student-photos.sql`).
 *
 * `students.photo_url` porte le CHEMIN du fichier (`{etablissement_id}/{id}.jpg`),
 * jamais une adresse : l'adresse se signe a l'affichage, avec le client de la
 * session (les regles d'acces du bucket s'appliquent).
 *
 * Validite d'UNE HEURE et non 60 s comme les documents : une photo s'affiche
 * dans une liste (trombinoscope) et se reaffiche a chaque changement de classe
 * ou d'onglet ; une adresse de 60 s la casserait des la minute suivante. Une
 * heure couvre une session (inactivite 20 min).
 */
export const BUCKET_PHOTOS = 'student-photos'
export const VALIDITE_PHOTO = 3600
/** 500 Ko (decision du 27/10), meme borne que `file_size_limit` du bucket. */
export const TAILLE_MAX_PHOTO = 512_000

/** Adresses signees des chemins donnes (les vides sont ignores), par chemin. */
export async function signerPhotos(
  supabase: SupabaseClient,
  chemins: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const uniques = [...new Set(chemins.filter((c): c is string => !!c))]
  const adresses = new Map<string, string>()
  if (uniques.length === 0) return adresses
  const { data } = await supabase.storage.from(BUCKET_PHOTOS).createSignedUrls(uniques, VALIDITE_PHOTO)
  for (const d of data ?? []) {
    if (d.path && d.signedUrl) adresses.set(d.path, d.signedUrl)
  }
  return adresses
}
