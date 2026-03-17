import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendNotificationEmail(params: {
  to: string[]
  subject: string
  html: string
}): Promise<{ success: boolean; error?: string }> {
  if (!resend || params.to.length === 0) {
    return { success: false, error: 'Email non configuré' }
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'Bilal Education <noreply@bilaleducation.fr>',
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
