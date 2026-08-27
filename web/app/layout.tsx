import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Brio',
  description: 'Plateforme pédagogique Brio',
}

// Reads localStorage('brio-theme'), falls back to prefers-color-scheme.
// Runs before first paint to eliminate flash of wrong theme.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('brio-theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.dataset.theme = stored;
      return;
    }
  } catch (_) {}
  // No stored preference — let CSS @media (prefers-color-scheme) handle it.
  // data-theme is intentionally left absent so the media-query fallback fires.
})();
`.trim()

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-surface-page font-prose text-ink antialiased">{children}</body>
    </html>
  )
}
