import Link from 'next/link'

export default function AbonnementExpirePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4"
      style={{ background: 'linear-gradient(135deg, #507583 0%, #18aa99 100%)' }}
    >
      {/* Cercles décoratifs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full opacity-10 bg-white" />
      </div>

      <div className="relative w-full max-w-md text-center">

        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg mb-6">
          <span className="text-white font-bold text-3xl leading-none">B</span>
        </div>

        {/* Carte */}
        <div
          className="bg-white rounded-3xl p-8"
          style={{ boxShadow: '0 24px 64px rgba(17,28,33,0.22), 0 8px 24px rgba(17,28,33,0.12)' }}
        >
          {/* Icône */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
          </div>

          <h1 className="text-xl font-bold text-secondary-800 mb-2">
            Accès suspendu
          </h1>
          <p className="text-sm text-warm-500 mb-6 leading-relaxed">
            L'abonnement de cet établissement est expiré ou inactif.<br />
            Veuillez contacter votre administrateur ou le support Bilal Education pour régulariser votre situation.
          </p>

          <div className="space-y-3">
            <a
              href="mailto:support@bilaleducation.fr"
              className="block w-full py-2.5 px-4 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              Contacter le support
            </a>
            <Link
              href="/login"
              className="block w-full py-2.5 px-4 rounded-xl border border-warm-200 text-warm-600 text-sm font-medium hover:bg-warm-50 transition-colors"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>

        <p className="mt-6 text-white/60 text-xs">
          Bilal <span className="text-amber-400">Education</span> — Gestion Administrative &amp; Pédagogique
        </p>
      </div>
    </div>
  )
}
