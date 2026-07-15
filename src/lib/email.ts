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

export interface EmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
}

export async function sendNotificationEmail(params: {
  to: string[]
  subject: string
  html: string
  /** Copie carbone invisible. Les destinataires de `to` ne la voient pas. */
  bcc?: string[]
  /** Adresse de reponse. Sans elle, le parent repond a EMAIL_FROM (souvent un noreply). */
  replyTo?: string
  attachments?: EmailAttachment[]
}): Promise<{ success: boolean; error?: string }> {
  if (!transporter) {
    return { success: false, error: 'Email non configuré (SMTP absent).' }
  }

  const to  = params.to.filter(Boolean)
  const bcc = (params.bcc ?? []).filter(Boolean)

  if (to.length === 0 && bcc.length === 0) {
    return { success: false, error: 'Aucun destinataire.' }
  }

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM ?? 'Bilal Education <noreply@bilaleducation.fr>',
      to:      to.join(', '),
      bcc:     bcc.length > 0 ? bcc.join(', ') : undefined,
      replyTo: params.replyTo || undefined,
      subject: params.subject,
      html:    params.html,
      attachments: params.attachments?.map(a => ({
        filename:    a.filename,
        content:     a.content,
        contentType: a.contentType,
      })),
    })
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}
