import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Photobooth',
  description: 'Custom photobooth — capture, preview, email.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
