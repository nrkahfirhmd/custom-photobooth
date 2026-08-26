import type { Metadata } from 'next'
import { Karla } from 'next/font/google'
import './globals.css'

const karla = Karla({ subsets: ['latin'], variable: '--font-karla', display: 'swap' })

export const metadata: Metadata = {
  title: 'Photobooth',
  description: 'Custom photobooth — capture, preview, email.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={karla.variable}>
      <body>{children}</body>
    </html>
  )
}
