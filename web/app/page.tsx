import Link from 'next/link'
import { getCatalogue } from '@/lib/api'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const catalogue = await getCatalogue()
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">brio</h1>
      <p className="mb-8 text-gray-500">Plateforme éducative pour le collège et le lycée.</p>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Niveaux
        </h2>
        <ul className="space-y-2">
          {catalogue.map(({ niveauCode, niveauLibelle }) => (
            <li key={niveauCode}>
              <Link
                href={`/${niveauCode}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-gray-900">{niveauLibelle}</p>
                <p className="mt-0.5 text-sm text-gray-500">{niveauCode}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
