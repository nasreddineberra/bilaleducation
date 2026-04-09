/**
 * Validation des variables d'environnement au démarrage.
 * Importé dans le root layout pour bloquer le boot si config invalide.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

export function validateEnv() {
  const missing: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Variables d'environnement manquantes : ${missing.join(', ')}\n` +
      `Copiez .env.example vers .env.local et remplissez les valeurs requises.`
    )
  }
}
