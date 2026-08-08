import Link from 'next/link'

/**
 * Écran d'arrêt, servi quand le middleware ne peut pas ouvrir l'application.
 *
 * DEUX MOTIFS, deux messages. La page ne disait qu'« abonnement expiré », et le
 * middleware y envoyait AUSSI les sous-domaines inconnus : celui qui se trompait
 * d'adresse s'entendait annoncer que son abonnement était expiré. Message faux,
 * et alarmant pour un client parfaitement à jour.
 *
 * Un seul écran plutôt que deux pages : même mise en page, même charte, seuls
 * le texte et les portes de sortie changent.
 */

// Adresse publique de l'éditeur. `support@` n'existe pas — les boîtes retenues
// sont `contact@`, `admin@` et `superadmin@`.
const CONTACT = 'contact@bilaleducation.fr'

type Motif = {
  titre: string
  texte: React.ReactNode
  /** Une adresse inconnue n'a pas d'écran de connexion où retourner : le
   *  middleware ne résout aucun établissement, `/login` renverrait ICI. */
  retourConnexion: boolean
  teinteFond: string
  teinteTrait: string
  icone: React.ReactNode
}

const MOTIFS: Record<'expire' | 'inconnu', Motif> = {
  expire: {
    titre: 'Accès suspendu',
    texte: (
      <>
        L&apos;abonnement de cet établissement est expiré ou inactif.<br />
        Veuillez contacter votre administrateur ou le support Bilal Education pour
        régulariser votre situation.
      </>
    ),
    retourConnexion: true,
    teinteFond: 'bg-amber-50',
    teinteTrait: 'text-amber-500',
    icone: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    ),
  },
  inconnu: {
    titre: 'Adresse inconnue',
    texte: (
      <>
        Aucun établissement ne correspond à cette adresse.<br />
        Vérifiez l&apos;orthographe du sous-domaine dans la barre d&apos;adresse de
        votre navigateur.
      </>
    ),
    retourConnexion: false,
    teinteFond: 'bg-warm-100',
    teinteTrait: 'text-warm-700',
    icone: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    ),
  },
}

export default async function AbonnementExpirePage({
  searchParams,
}: {
  searchParams: Promise<{ raison?: string }>
}) {
  const { raison } = await searchParams
  const motif = MOTIFS[raison === 'inconnu' ? 'inconnu' : 'expire']

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
            <div className={`w-14 h-14 rounded-2xl ${motif.teinteFond} flex items-center justify-center`}>
              <svg className={`w-7 h-7 ${motif.teinteTrait}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                {motif.icone}
              </svg>
            </div>
          </div>

          <h1 className="text-xl font-bold text-secondary-800 mb-2">
            {motif.titre}
          </h1>
          <p className="text-sm text-warm-700 mb-6 leading-relaxed">
            {motif.texte}
          </p>

          <div className="space-y-3">
            <a
              href={`mailto:${CONTACT}`}
              className="block w-full py-2.5 px-4 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors"
            >
              Contacter le support
            </a>
            {motif.retourConnexion && (
              <Link
                href="/login"
                className="block w-full py-2.5 px-4 rounded-xl border border-warm-200 text-warm-700 text-sm font-medium hover:bg-warm-50 transition-colors"
              >
                Retour à la connexion
              </Link>
            )}
          </div>
        </div>

        <p className="mt-6 text-white/60 text-xs">
          Bilal <span className="text-amber-400">Education</span> · Gestion Administrative &amp; Pédagogique
        </p>
      </div>
    </div>
  )
}
