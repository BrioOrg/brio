import { ChapterView } from '@/components/chapter-view'
import { getChapitre } from '@/lib/api'
import Link from 'next/link'

export default async function ChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    const chapitre = await getChapitre(id)
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <nav className="mb-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Accueil
          </Link>
        </nav>
        <ChapterView chapitre={chapitre} />
      </main>
    )
  } catch {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <nav className="mb-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Accueil
          </Link>
        </nav>
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Chapitre introuvable</p>
          <p className="mt-1 text-sm">
            Le chapitre{' '}
            <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs">{id}</code>{' '}
            n&apos;est pas disponible ou le serveur est inaccessible.
          </p>
        </div>
      </main>
    )
  }
}
