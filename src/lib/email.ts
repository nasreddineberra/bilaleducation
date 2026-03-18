import nodemailer from 'nodemailer'

const transporter =
  process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null

export async function sendNotificationEmail(params: {
  to: string[]
  subject: string
  html: string
}): Promise<{ success: boolean; error?: string }> {
  if (!transporter || params.to.length === 0) {
    return { success: false, error: 'Email non configuré' }
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'Bilal Education <noreply@bilaleducation.fr>',
      to: params.to.join(', '),
      subject: params.subject,
      html: params.html,
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
