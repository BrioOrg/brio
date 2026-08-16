import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brio',
  description: 'Plateforme pédagogique Brio',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
