import { ThemeToggle } from './theme-toggle'
import { OptionRowDemo, ButtonLoadingDemo, ResultSheetDemo } from './kit-interactive'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { OptionRow } from '@/components/ui/option-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Chip } from '@/components/ui/chip'
import { TextInput } from '@/components/ui/text-input'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { StudentBubble } from '@/components/ui/chat/student-bubble'
import { AssistantBubble } from '@/components/ui/chat/assistant-bubble'
import { RefusalBubble } from '@/components/ui/chat/refusal-bubble'
import { CitationChip } from '@/components/ui/chat/citation-chip'
import { SuggestedQuestion } from '@/components/ui/chat/suggested-question'
import { TypingIndicator } from '@/components/ui/chat/typing-indicator'
import { Icon } from '@/components/ui/icon'

export const metadata = { title: 'Design — Brio' }

/* ── helpers ──────────────────────────────────────────────────────────────── */

function Swatch({ token, label }: { token: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="block h-10 w-10 shrink-0 rounded-md border border-line"
        style={{ background: `var(--color-${token})` }}
      />
      <span className="font-prose text-sm text-ink-muted">
        <span className="font-semibold text-ink">{label}</span>
        <br />
        <code className="text-xs">--color-{token}</code>
      </span>
    </div>
  )
}

function Section({
  title,
  id,
  children,
}: {
  children: React.ReactNode
  id?: string
  title: string
}) {
  return (
    <section id={id} className="border-t border-line pt-8">
      <h2 className="mb-6 font-display text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-prose text-xs font-semibold uppercase tracking-widest text-ink-muted">
      {children}
    </p>
  )
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function DesignPage() {
  return (
    <div className="min-h-screen bg-surface-page font-prose text-ink">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface-panel px-6 py-4">
        <h1 className="font-display text-lg font-bold text-ink">
          brio <span className="text-accent">design</span>
        </h1>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-10">
        {/* ── Surfaces ──────────────────────────────────────────────────────── */}
        <Section title="Surfaces">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ['surface-page', 'surface-page'],
              ['surface-panel', 'surface-panel'],
              ['surface-raised', 'surface-raised'],
              ['surface-result-correct', 'surface-result-correct'],
              ['surface-result-incorrect', 'surface-result-incorrect'],
            ].map(([token, label]) => (
              <div
                key={token}
                className="rounded-lg border border-line p-4 text-center"
                style={{ background: `var(--color-${token})` }}
              >
                <p className="text-xs text-ink-muted">{label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Palette ───────────────────────────────────────────────────────── */}
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

        {/* ── Typography ────────────────────────────────────────────────────── */}
        <Section title="Typographie">
          <div className="flex flex-col gap-4">
            <div>
              <Label>Display — Nunito Variable</Label>
              <p
                className="font-display font-extrabold leading-tight text-ink"
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
                <code className="w-10 shrink-0 text-xs text-ink-muted">{step}</code>
                <span className={`font-prose text-${step} text-ink`}>
                  Les mathématiques sont une langue — {px}
                </span>
              </div>
            ))}

            <div className="mt-2 border-t border-line pt-4">
              <Label>Prose — Nunito Sans Variable</Label>
              <p className="max-w-prose font-prose text-base leading-relaxed text-ink">
                Dans ce cours, tu vas découvrir les bases de la géométrie plane. Chaque notion est
                construite pas à pas, avec des exemples tirés de situations réelles. Prends le temps
                de lire chaque définition avant de passer aux exercices.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Radii ─────────────────────────────────────────────────────────── */}
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
                  className={`h-16 w-16 border-2 border-accent bg-accent-soft rounded-${size}`}
                />
                <p className="text-center text-xs text-ink-muted">
                  <span className="font-semibold text-ink">{size}</span>
                  <br />
                  {px}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Motion ────────────────────────────────────────────────────────── */}
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
                  className="h-10 w-8 cursor-pointer rounded-md bg-accent hover:w-64"
                  style={{ transition: `width var(--duration-${name}) var(--ease-out)` }}
                />
                <span className="font-prose text-sm text-ink">
                  <strong>{label}</strong> — {desc}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Icons ─────────────────────────────────────────────────────────── */}
        <Section title="Icônes — Phosphor (Regular + Bold)">
          <p className="mb-4 text-sm text-ink-muted">
            Sprite auto-généré depuis <code>@phosphor-icons/core</code> via{' '}
            <code>scripts/build-icon-sprite.mjs</code>. 20 icônes, 2 graisses.
          </p>
          <div className="flex flex-wrap gap-4">
            {[
              'arrow-left',
              'arrow-right',
              'arrow-up-right',
              'book-open',
              'caret-right',
              'chat-circle',
              'check',
              'circle-notch',
              'eye',
              'eye-slash',
              'flame',
              'info',
              'lightning',
              'lock-simple',
              'smiley',
              'sparkle',
              'star',
              'trophy',
              'warning-circle',
              'x',
            ].map((name) => (
              <div key={name} className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <Icon name={name} size={24} className="text-ink" />
                  <Icon name={name} weight="bold" size={24} className="text-accent" />
                </div>
                <code className="text-center text-xs text-ink-muted">{name}</code>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Button ────────────────────────────────────────────────────────── */}
        <Section title="Bouton">
          <div className="flex flex-col gap-6">
            <div>
              <Label>Variantes</Label>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primaire</Button>
                <Button variant="secondary">Secondaire</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructif</Button>
              </div>
            </div>

            <div>
              <Label>Tailles</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Petit</Button>
                <Button size="md">Moyen</Button>
                <Button size="lg">Grand</Button>
              </div>
            </div>

            <div>
              <Label>États</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Button disabled>Désactivé</Button>
                <ButtonLoadingDemo />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Panel ─────────────────────────────────────────────────────────── */}
        <Section title="Panneau / carte">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Panel>
              <p className="font-display text-sm font-bold text-ink">surface-panel</p>
              <p className="mt-1 text-sm text-ink-muted">Panneau de base pour le contenu.</p>
            </Panel>
            <Panel raised>
              <p className="font-display text-sm font-bold text-ink">surface-raised</p>
              <p className="mt-1 text-sm text-ink-muted">
                Panneau surélevé pour les éléments cliquables.
              </p>
            </Panel>
          </div>
        </Section>

        {/* ── Option row ────────────────────────────────────────────────────── */}
        <Section title="Rangée d'option (QCM)">
          <div className="flex flex-col gap-4">
            <div>
              <Label>Tous les états (statiques)</Label>
              <div className="flex flex-col gap-2">
                {(['idle', 'selected', 'correct', 'wrong', 'muted'] as const).map((s) => (
                  <OptionRow
                    key={s}
                    label={`État : ${s}`}
                    marker={
                      s === 'idle'
                        ? 'A'
                        : s === 'selected'
                          ? 'B'
                          : s === 'correct'
                            ? 'C'
                            : s === 'wrong'
                              ? 'D'
                              : 'E'
                    }
                    state={s}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Interactif — clique pour changer d&apos;état</Label>
              <OptionRowDemo />
            </div>
          </div>
        </Section>

        {/* ── Result sheet ──────────────────────────────────────────────────── */}
        <Section title="Fiche de résultat">
          <p className="mb-4 text-sm text-ink-muted">
            Déclenche la fiche depuis les boutons ci-dessous. Elle monte depuis le bas (slide-up).
          </p>
          <ResultSheetDemo />
        </Section>

        {/* ── Progress bar ──────────────────────────────────────────────────── */}
        <Section title="Barre de progression">
          <div className="flex flex-col gap-4">
            <ProgressBar value={4} max={7} />
            <ProgressBar value={1} max={7} />
            <ProgressBar value={7} max={7} />
            <ProgressBar value={3} max={7} showCounter={false} />
          </div>
        </Section>

        {/* ── Chip ──────────────────────────────────────────────────────────── */}
        <Section title="Chip / badge">
          <div className="flex flex-wrap gap-3">
            <Chip variant="level">Terminale</Chip>
            <Chip variant="level" icon="book-open">
              Mathématiques
            </Chip>
            <Chip variant="citation" icon="info">
              Source : cours §3.2
            </Chip>
            <Chip variant="status">Nouveau</Chip>
            <Chip variant="status" icon="check">
              Complété
            </Chip>
          </div>
        </Section>

        {/* ── Text input ────────────────────────────────────────────────────── */}
        <Section title="Champ texte">
          <div className="flex flex-col gap-4 max-w-sm">
            <TextInput label="Réponse" placeholder="Ta réponse ici…" />
            <TextInput
              label="Réponse (focus simulé)"
              placeholder="Ta réponse ici…"
              defaultValue="180 degrés"
            />
            <TextInput
              label="Réponse (état erreur)"
              placeholder="Ta réponse ici…"
              defaultValue="360 degrés"
              error="Ce n'est pas la bonne valeur — relis la définition."
            />
          </div>
        </Section>

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        <Section title="État vide">
          <Panel>
            <EmptyState
              icon="book-open"
              title="Aucun cours pour l'instant"
              description="Les cours de cette matière apparaîtront ici dès qu'ils seront disponibles."
              action={
                <Button size="sm" variant="secondary">
                  Explorer le catalogue
                </Button>
              }
            />
          </Panel>
        </Section>

        {/* ── Skeleton ──────────────────────────────────────────────────────── */}
        <Section title="Squelette de chargement">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 shrink-0" rounded="pill" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
            <Skeleton className="h-32 w-full" rounded="lg" />
            <SkeletonText lines={3} />
          </div>
        </Section>

        {/* ── Chat primitives ───────────────────────────────────────────────── */}
        <Section title="Primitives de chat (tuteur IA)">
          <div className="flex flex-col gap-4">
            <Label>Fil de conversation</Label>
            <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-panel p-4">
              <StudentBubble>Comment calculer l&apos;aire d&apos;un triangle ?</StudentBubble>
              <AssistantBubble>
                Bonne question ! L&apos;aire d&apos;un triangle se calcule avec la formule{' '}
                <strong>A = (base × hauteur) / 2</strong>. Tu te souviens de la hauteur ?
                <CitationChip>Cours §4.1 — Polygones</CitationChip>
              </AssistantBubble>
              <StudentBubble>Donne-moi juste la réponse de l&apos;exercice 3.</StudentBubble>
              <RefusalBubble variant="socratic">
                Je ne donne pas les réponses des exercices — je t&apos;aide à les trouver. Quel est
                l&apos;énoncé de l&apos;exercice 3 ?
              </RefusalBubble>
              <AssistantBubble>
                Voici ce que dit le cours à ce sujet.
                <CitationChip>Cours §2.3 — Triangles isocèles</CitationChip>
              </AssistantBubble>
              <RefusalBubble variant="policy">
                Cette question est hors du programme de ce cours. Je ne peux pas t&apos;aider avec
                ça ici.
              </RefusalBubble>
              <TypingIndicator />
            </div>

            <Label>Questions suggérées</Label>
            <div className="flex flex-col gap-2">
              <SuggestedQuestion>
                Comment démontrer qu&apos;un triangle est isocèle ?
              </SuggestedQuestion>
              <SuggestedQuestion>
                Quelle est la différence entre hauteur et médiane ?
              </SuggestedQuestion>
            </div>
          </div>
        </Section>

        {/* ── Danger constraint ─────────────────────────────────────────────── */}
        <Section title="Contrainte : danger">
          <Panel raised>
            <p className="text-sm leading-relaxed text-ink">
              <span className="font-semibold text-danger">danger</span> est réservé aux actions
              irréversibles (suppression de compte, suppression de contenu). Il ne doit jamais
              apparaître dans un exercice ou dans un flux élève normal. Si tu le vois là, le mapping
              est incorrect.
            </p>
          </Panel>
        </Section>
      </main>
    </div>
  )
}
