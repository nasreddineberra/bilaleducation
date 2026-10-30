import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import MessageDetailClient from '@/components/communications/MessageDetailClient'
import { chargerMessage } from '@/lib/communications/donnees'

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // Message, destinataires et pieces jointes (`lib/communications/donnees.ts`)
  const detail = await chargerMessage(supabase, id, etablissementId)
  if (!detail) return notFound()

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Retour : motif commun aux fiches, rendu au niveau page (comme classes/[id],
          annee-scolaire/[id]) pour une structure identique. */}
      <Link
        href="/dashboard/communications"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <MessageDetailClient {...detail} />
    </div>
  )
}
