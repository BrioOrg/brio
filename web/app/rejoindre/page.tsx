import type { Metadata } from 'next'
import { RejoindreForm } from '@/components/rejoindre-form'

export const metadata: Metadata = {
  title: 'Rejoindre ma classe — brio',
}

export default function RejoindrePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="font-display text-2xl font-black tracking-tight text-ink">
            br<span className="text-accent">io</span>
          </span>
        </div>

        <div className="rounded-lg border border-line bg-surface-panel p-6 sm:p-8">
          <h1 className="font-display text-2xl font-black leading-tight tracking-tight text-ink">
            Rejoins ta <span className="text-accent">classe</span>
          </h1>
          <p className="mt-2 mb-6 font-prose text-sm text-ink-muted">
            Entre le code donné par ton prof, choisis ton prénom et un mot de passe.
          </p>

          <RejoindreForm />
        </div>
      </div>
    </main>
  )
}
