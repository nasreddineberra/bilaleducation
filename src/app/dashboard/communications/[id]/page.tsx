import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import MessageDetailClient from '@/components/communications/MessageDetailClient'

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // Message
  const { data: message } = await supabase
    .from('announcements')
    .select('*, profiles:published_by(first_name, last_name, email), classes:target_class_id(name, day_of_week, start_time, end_time, cotisation_types(label))')
    .eq('id', id)
    .eq('etablissement_id', etablissementId)
    .single()

  if (!message) return notFound()

  // Infos de la classe ciblee (enseignant principal), pour un message « classe ».
  let classTeacher: { name: string; civilite: string | null } | null = null
  if (message.target_class_id) {
    const { data: ct } = await supabase
      .from('class_teachers')
      .select('teachers(civilite, first_name, last_name)')
      .eq('class_id', message.target_class_id)
      .eq('is_main_teacher', true)
      .maybeSingle() as { data: { teachers: { civilite: string | null; first_name: string; last_name: string } | null } | null }
    if (ct?.teachers) {
      // NOM avant Prenom : regle de l'application.
      classTeacher = { name: `${ct.teachers.last_name} ${ct.teachers.first_name}`, civilite: ct.teachers.civilite }
    }
  }

  // Destinataires parents
  const { data: parentRecipients } = await supabase
    .from('announcement_recipients')
    .select('id, email, email_status, is_read, parent_id, parents:parent_id(tutor1_last_name, tutor1_first_name)')
    .eq('announcement_id', id)

  // Destinataires staff
  const { data: staffRecipients } = await supabase
    .from('announcement_staff_recipients')
    .select('id, email, email_status, is_read, profile_id, profiles:profile_id(first_name, last_name, role)')
    .eq('announcement_id', id)

  // Pieces jointes. Le bucket est prive : on signe a la consultation plutot que
  // de stocker une URL publique (meme regle que les justificatifs d'absence).
  const { data: attachments } = await supabase
    .from('announcement_attachments')
    .select('id, file_path, file_name, file_size')
    .eq('announcement_id', id)

  const signedAttachments = await Promise.all(
    ((attachments ?? []) as any[]).map(async a => {
      const { data: signed } = await supabase.storage
        .from('communication-attachments')
        .createSignedUrl(a.file_path, 3600)
      return { id: a.id, file_name: a.file_name, file_size: a.file_size, url: signed?.signedUrl ?? null }
    })
  )

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Retour : motif commun aux fiches, rendu au niveau page (comme classes/[id],
          annee-scolaire/[id]) pour une structure identique. */}
      <Link
        href="/dashboard/communications"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <MessageDetailClient
        message={message as any}
        classTeacher={classTeacher}
        parentRecipients={(parentRecipients ?? []) as any[]}
        staffRecipients={(staffRecipients ?? []) as any[]}
        attachments={signedAttachments}
      />
    </div>
  )
}
