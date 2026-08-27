import { ThemeToggle } from './theme-toggle'

export const metadata = { title: 'Design — Brio' }

/* ── helpers ──────────────────────────────────────────────────────────────── */

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="block w-10 h-10 rounded-md border border-line shrink-0"
        style={{ background: `var(--color-${token})` }}
      />
      <span className="font-prose text-sm text-ink-muted">
        <span className="text-ink font-semibold">{label}</span>
        <br />
        <code className="text-xs">--color-{token}</code>
      </span>
    </div>
  )
}

function Section({ title, children }: { children: React.ReactNode; title: string }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="font-display text-xl font-bold text-ink mb-6">{title}</h2>
      {children}
    </section>
  )
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-surface-page text-ink font-prose">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-surface-panel border-b border-line px-6 py-4 flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">
          brio <span className="text-accent">design</span>
        </h1>
        <ThemeToggle />
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-10">
        {/* Surfaces */}
        <Section title="Surfaces">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-page border border-line p-4 text-center">
              <p className="text-xs text-ink-muted mb-1">surface-page</p>
              <p className="text-sm text-ink font-semibold">#0a1310</p>
            </div>
            <div className="rounded-lg bg-surface-panel border border-line p-4 text-center">
              <p className="text-xs text-ink-muted mb-1">surface-panel</p>
              <p className="text-sm text-ink font-semibold">#0e1a16</p>
            </div>
            <div className="rounded-lg bg-surface-raised border border-line p-4 text-center">
              <p className="text-xs text-ink-muted mb-1">surface-raised</p>
              <p className="text-sm text-ink font-semibold">#14271d</p>
            </div>
          </div>
        </Section>

        {/* Palette */}
        <Section title="Palette sémantique">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Swatch token="ink" label="ink" />
            <Swatch token="ink-muted" label="ink-muted" />
            <Swatch token="line" label="line" />
            <Swatch token="accent" label="accent" />
            <Swatch token="accent-hi" label="accent-hi" />
            <Swatch token="accent-edge" label="accent-edge" />
            <Swatch token="accent-soft" label="accent-soft" />
            <Swatch token="accent-ink" label="accent-ink" />
            <Swatch token="success" label="success" />
            <Swatch token="danger" label="danger" />
            <Swatch token="warning" label="warning" />
            <Swatch token="info" label="info" />
            <Swatch token="feedback-incorrect" label="feedback-incorrect" />
            <Swatch token="feedback-incorrect-edge" label="feedback-incorrect-edge" />
            <Swatch token="xp" label="xp" />
            <Swatch token="streak" label="streak" />
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typographie">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-ink-muted mb-2 uppercase tracking-widest font-semibold">
                Display — Nunito Variable
              </p>
              <p
                className="font-display font-extrabold text-ink leading-tight"
                style={{ fontSize: 'var(--text-display)' }}
              >
                Apprends, progresse, réussis.
              </p>
            </div>

            {(
              [
                ['3xl', '26px'],
                ['2xl', '22px'],
                ['xl', '19px'],
                ['lg', '16px'],
                ['base', '15px'],
                ['sm', '13px'],
                ['xs', '11px'],
                ['2xs', '10px'],
              ] as const
            ).map(([step, px]) => (
              <div key={step} className="flex items-baseline gap-4">
                <code className="text-xs text-ink-muted w-10 shrink-0">{step}</code>
                <span className={`font-prose text-${step} text-ink`}>
                  Les mathématiques sont une langue — {px}
                </span>
              </div>
            ))}

            <div className="mt-2 border-t border-line pt-4">
              <p className="text-xs text-ink-muted mb-2 uppercase tracking-widest font-semibold">
                Prose — Nunito Sans Variable
              </p>
              <p className="font-prose text-base text-ink leading-relaxed max-w-prose">
                Dans ce cours, tu vas découvrir les bases de la géométrie plane. Chaque notion est
                construite pas à pas, avec des exemples tirés de situations réelles. Prends le temps
                de lire chaque définition avant de passer aux exercices.
              </p>
            </div>
          </div>
        </Section>

        {/* Radii */}
        <Section title="Rayons">
          <div className="flex flex-wrap gap-4">
            {(
              [
                ['sm', '10px'],
                ['md', '14px'],
                ['lg', '18px'],
                ['xl', '24px'],
                ['pill', '∞'],
              ] as const
            ).map(([size, px]) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <div
                  className={`w-16 h-16 bg-accent-soft border-2 border-accent rounded-${size}`}
                />
                <p className="text-xs text-ink-muted text-center">
                  <span className="text-ink font-semibold">{size}</span>
                  <br />
                  {px}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* Arcade button depth */}
        <Section title="Profondeur arcade">
          <div className="flex gap-6 flex-wrap">
            <button
              className="font-display font-extrabold text-lg px-6 py-3 rounded-lg bg-accent text-surface-page border-none cursor-pointer"
              style={{
                boxShadow: 'var(--shadow-arcade)',
                transition: `transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)`,
              }}
            >
              Valider
            </button>
            <p className="font-prose text-sm text-ink-muted self-center">
              <code>--shadow-arcade</code> : offset de <code>var(--depth-arcade)</code> (5 px) sur{' '}
              <code>--color-accent-edge</code>
            </p>
          </div>
        </Section>

        {/* Motion */}
        <Section title="Motion">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Survole les barres pour voir les durées. L&rsquo;animation est désactivée si{' '}
              <code>prefers-reduced-motion</code> est actif.
            </p>
            {(
              [
                ['fast', '100 ms', 'Micro-interaction'],
                ['base', '120 ms', 'Transition standard'],
                ['slow', '300 ms', 'Entrée / sortie'],
              ] as const
            ).map(([name, label, desc]) => (
              <div key={name} className="flex items-center gap-4">
                <div
                  className="h-10 bg-accent rounded-md w-8 hover:w-64 cursor-pointer"
                  style={{
                    transition: `width var(--duration-${name}) var(--ease-out)`,
                  }}
                />
                <span className="font-prose text-sm text-ink">
                  <strong>{label}</strong> — {desc}
                </span>
              </div>
            ))}

            <div className="mt-2 border-t border-line pt-4">
              <p className="text-xs text-ink-muted mb-3 uppercase tracking-widest font-semibold">
                ease-spring — récompenses uniquement
              </p>
              <div
                className="inline-block w-10 h-10 bg-xp rounded-pill hover:scale-150 cursor-pointer"
                style={{
                  transition: `transform var(--duration-slow) var(--ease-spring)`,
                }}
              />
            </div>
          </div>
        </Section>

        {/* Danger usage constraint */}
        <Section title="Contrainte : danger">
          <div className="rounded-lg bg-surface-raised border border-line p-4">
            <p className="font-prose text-sm text-ink leading-relaxed">
              <span className="text-danger font-semibold">danger</span> est réservé aux actions
              irréversibles (suppression de compte, suppression de contenu). Il ne doit jamais
              apparaître dans un exercice ou dans un flux élève normal. Si tu le vois là, le mapping
              est incorrect.
            </p>
          </div>
        </Section>
      </main>
    </div>
  )
}
