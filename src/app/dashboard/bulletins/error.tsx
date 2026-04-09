'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'

export default function BulletinsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[bulletins] Erreur interceptée:', error)
  }, [error])

  const handleRetry = () => {
    reset()
    router.refresh()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-6">
        <AlertTriangle size={32} className="text-amber-500" />
      </div>

      <h2 className="text-xl font-bold text-secondary-800 mb-2">
        Une erreur est survenue
      </h2>

      <p className="text-sm text-warm-500 mb-6 max-w-md leading-relaxed">
        Le chargement de cette page a échoué.
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
          onClick={() => router.push('/dashboard')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm bg-warm-100 text-warm-600 hover:bg-warm-200 transition-colors"
        >
          <ArrowLeft size={15} />
          Retour à l'accueil
        </button>
      </div>
    </div>
  )
}
