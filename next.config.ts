import type { NextConfig } from 'next'

const config: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'nodemailer'],
}

export default config
