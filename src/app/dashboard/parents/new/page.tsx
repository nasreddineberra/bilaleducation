import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ParentForm from '@/components/parents/ParentForm'

export default function NewParentPage() {
  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/parents"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ParentForm />

    </div>
  )
}
