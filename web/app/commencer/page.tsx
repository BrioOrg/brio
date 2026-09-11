import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'

export const metadata: Metadata = {
  title: 'Commencer — brio',
}

type Door = {
  href: string
  icon: string
  title: string
  description: string
}

// The two ways a student starts on brio (ADR 0016 §5):
//  A — a class invitation code from their teacher (chemin A, #65)
//  B — self-signup, then a parent gives the go-ahead (chemin B, #64)
const DOORS: readonly Door[] = [
  {
    href: '/rejoindre',
    icon: 'lightning',
    title: 'J’ai un code de classe',
    description: 'Ton prof t’a donné un code ? Entre-le pour rejoindre ta classe.',
  },
  {
    href: '/inscription',
    icon: 'smiley',
    title: 'Je m’inscris tout seul',
    description: 'Pas de code ? Crée ton compte — un parent validera ensuite.',
  },
]

export default function CommencerPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="font-display text-2xl font-black tracking-tight text-ink">
            br<span className="text-accent">io</span>
          </span>
        </div>

        <h1 className="text-center font-display text-2xl font-black leading-tight tracking-tight text-ink">
          On commence&nbsp;?
        </h1>
        <p className="mt-2 mb-6 text-center font-prose text-sm text-ink-muted">
          Comment veux-tu rejoindre brio&nbsp;?
        </p>

        <ul className="flex flex-col gap-3">
          {DOORS.map(({ href, icon, title, description }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex items-center gap-4 rounded-lg border border-line bg-surface-panel p-4 transition-[transform,border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-accent hover:[box-shadow:0_5px_0_var(--color-accent-edge)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-md border-2 border-line bg-surface-raised text-accent">
                  <Icon name={icon} weight="bold" size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-extrabold leading-tight text-ink">
                    {title}
                  </span>
                  <span className="mt-1 block font-prose text-sm text-ink-muted">{description}</span>
                </span>
                <Icon
                  name="arrow-right"
                  weight="bold"
                  size={20}
                  className="shrink-0 text-ink-muted transition-transform duration-[var(--duration-base)] group-hover:translate-x-1 group-hover:text-accent"
                />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center font-prose text-sm text-ink-muted">
          Déjà un compte&nbsp;?{' '}
          <Link
            href="/connexion"
            className="rounded-sm font-extrabold text-accent-ink hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}
