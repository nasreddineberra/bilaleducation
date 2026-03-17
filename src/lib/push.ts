import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ''
const VAPID_SUBJECT = process.env.EMAIL_FROM
  ? `mailto:${process.env.EMAIL_FROM.match(/<(.+)>/)?.[1] ?? 'noreply@bilaleducation.fr'}`
  : 'mailto:noreply@bilaleducation.fr'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0 }

  const supabase = createAdminClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  const expiredIds: string[] = []

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        JSON.stringify(payload)
      )
      sent++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        expiredIds.push(sub.id)
      }
      failed++
    }
  }

  // Nettoyage des subscriptions expirées
  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
  }

  return { sent, failed }
}
