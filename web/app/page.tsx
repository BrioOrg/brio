import { getPingStatus } from '@/lib/api'
import { PingStatus } from '@/components/ping-status'

export default async function HomePage() {
  try {
    const data = await getPingStatus()
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-6 text-2xl font-bold">État du système</h1>
        <PingStatus result={{ status: 'success', data }} />
      </main>
    )
  } catch {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="mb-6 text-2xl font-bold">État du système</h1>
        <PingStatus result={{ status: 'error' }} />
      </main>
    )
  }
}
