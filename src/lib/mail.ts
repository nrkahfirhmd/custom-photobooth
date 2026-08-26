import nodemailer from 'nodemailer'
import { decrypt } from './crypto'
import type { WorkspaceRow } from './db'

export { isValidEmail } from './validate'

export function transportFor(ws: WorkspaceRow) {
  return nodemailer.createTransport({
    host: ws.smtp_host,
    port: ws.smtp_port,
    secure: ws.smtp_port === 465,
    auth: { user: ws.smtp_user, pass: decrypt(ws.smtp_pass_enc) },
  })
}

export function fromHeader(ws: WorkspaceRow) {
  // Pass as an object so nodemailer encodes the display name itself.
  return { name: ws.from_name || ws.name, address: ws.from_email }
}

export function smtpConfigured(ws: WorkspaceRow) {
  return Boolean(ws.smtp_host && ws.smtp_user && ws.smtp_pass_enc && ws.from_email)
}
