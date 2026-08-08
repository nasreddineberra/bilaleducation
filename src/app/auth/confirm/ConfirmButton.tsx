'use client'

import { useFormStatus } from 'react-dom'

/**
 * Bouton de confirmation, désactivé pendant la vérification.
 *
 * `useFormStatus` doit vivre dans un composant ENFANT du `<form>` : il lit
 * l'état du formulaire parent, et renverrait toujours « inactif » s'il était
 * appelé dans le composant qui rend le formulaire lui-même.
 */
export default function ConfirmButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-3 px-4 rounded-xl bg-primary-500 text-white text-base font-semibold hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      {pending ? 'Vérification…' : children}
    </button>
  )
}
