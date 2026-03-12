import 'server-only'

export const SMTP_HOST = process.env.SMTP_HOST?.trim() ?? ''
export const SMTP_PORT = Number(process.env.SMTP_PORT ?? '465')
export const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === 'true'
  : SMTP_PORT === 465
export const SMTP_USER = process.env.SMTP_USER?.trim() ?? ''
export const SMTP_PASS = process.env.SMTP_PASS?.trim() ?? ''
export const SMTP_FROM = process.env.SMTP_FROM?.trim() || SMTP_USER

export const hasSmtpConfiguration = Boolean(
  SMTP_HOST
  && Number.isFinite(SMTP_PORT)
  && SMTP_USER
  && SMTP_PASS,
)
