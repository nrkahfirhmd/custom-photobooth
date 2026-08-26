import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'nodemailer'],
  // Next's dev server blocks cross-origin requests to /_next/static/* and the
  // HMR socket by default — anything not "localhost" gets a 403, which breaks
  // hydration entirely (the page loads, the JS bundle doesn't, so nothing on
  // the page actually works). Needed to test through a tunnel (ngrok, etc.).
  // Dev-only: has no effect on `next build`/`next start`.
  allowedDevOrigins: ['*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io'],
}

export default config
