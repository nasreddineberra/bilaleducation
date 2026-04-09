'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[root] Erreur interceptée:', error)
  }, [error])

  const handleRetry = () => {
    reset()
    router.refresh()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6 bg-warm-50">
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
        <AlertTriangle size={40} className="text-red-500" />
      </div>

      <h2 className="text-2xl font-bold text-secondary-800 mb-2">
        Une erreur est survenue
      </h2>

      <p className="text-sm text-warm-500 mb-6 max-w-md leading-relaxed">
        Le chargement de l'application a échoué. Cela peut être dû à un problème de connexion ou à une erreur temporaire du serveur.
      </p>

      <div className="flex gap-3">
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-secondary-700 text-white hover:bg-secondary-800 transition-colors shadow-sm"
        >
          <RefreshCw size={15} />
          Réessayer
        </button>

        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-warm-100 text-warm-600 hover:bg-warm-200 transition-colors"
        >
          <Home size={15} />
          Accueil
        </button>
      </div>
    </div>
  )
}
