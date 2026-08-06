import Image from 'next/image'

/**
 * Page servie sur le domaine RACINE (`bilaleducation.fr`).
 *
 * Le middleware y réécrit `/` : la racine n'appartient à aucune école et ne doit
 * donc pas entrer dans la résolution d'établissement, qui chercherait une école
 * nommée « bilaleducation » et afficherait « accès suspendu ».
 *
 * Page d'ATTENTE, volontairement minimale : elle tient la place jusqu'à la vraie
 * vitrine commerciale. Aucun lien de connexion — les écoles entrent par leur
 * propre sous-domaine, l'éditeur par le sien. Une adresse publique n'a pas à
 * révéler où se trouvent les portes.
 */
export default function VitrinePage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 text-center"
      style={{ background: 'linear-gradient(145deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
    >
      {/* Même bloc de marque que l'écran de connexion : logo à gauche, nom sur
          deux lignes à côté, l'ensemble aligné sur la hauteur du symbole. */}
      <div className="flex items-center gap-5">
        <Image src="/icon.png" alt="" width={104} height={104} unoptimized className="flex-shrink-0" />
        <div className="text-left leading-[0.95] bg-clip-text text-transparent nom-vague">
          <p className="text-[40px] font-bold tracking-wide">BILAL</p>
          <p className="text-[40px] font-bold tracking-wide">EDUCATION</p>
        </div>
      </div>

      <p className="text-white/70 text-lg max-w-md leading-snug">
        Plateforme de gestion administrative et pédagogique
        <span className="block mt-1 text-white/50 text-base">
          pour les écoles arabes et islamiques
        </span>
      </p>

      <p className="text-white/40 text-xs">Site en construction</p>
    </main>
  )
}
