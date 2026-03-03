import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import UtilisateurForm from '@/components/utilisateurs/UtilisateurForm'

export default function NewUtilisateurPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/dashboard/utilisateurs"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>
      <UtilisateurForm />
    </div>
  )
}
