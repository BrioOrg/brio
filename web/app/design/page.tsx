import 'katex/dist/katex.min.css'

import { ThemeToggle } from '@/components/ui/theme-toggle'
import { OptionRowDemo, ButtonLoadingDemo, ResultSheetDemo } from './kit-interactive'
import { EditeurMessageDemo } from './editeur-message-demo'
import { CalculDemo } from './calcul-demo'
import { MotionDemo } from './motion-demo'
import { SoundDemo } from './sound-demo'
import { TransformationsDemo } from './transformations-demo'
import { BlocsCommunaute } from '@/components/blocs/blocs-communaute'
import { CalculRenderer } from '@/components/calcul-renderer'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { OptionRow } from '@/components/ui/option-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import { Chip } from '@/components/ui/chip'
import { SelectInput } from '@/components/ui/select-input'
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
import { Mascot } from '@/components/ui/mascot'
import { FigureRenderer } from '@/components/figure-renderer'
import { renderKatex } from '@/lib/katex'
import { TreeRenderer } from '@/components/tree-renderer'
import type { FigureSpec, TreeSpec } from '@brio/content'

export const metadata = { title: 'Design — Brio' }

/* ── helpers ──────────────────────────────────────────────────────────────── */

const SCRATCH_CATEGORIES = [
  ['events', 'Événements'],
  ['control', 'Contrôle'],
  ['motion', 'Mouvement'],
  ['looks', 'Apparence'],
  ['sensing', 'Capteurs'],
  ['operators', 'Opérateurs'],
  ['variables', 'Variables'],
] as const

// Maths tones (ADR 0037): the same object in the same tone in the figure and in the formula.
const hidden = { dot: false, showName: false } as const
const TONE_EXAMPLES: { spec: FigureSpec; alt: string; latex: string }[] = [
  {
    alt: 'Triangle ABC rectangle en A : AB en teinte 1, AC en teinte 2, l’hypoténuse BC en teinte 3.',
    spec: {
      points: [
        { name: 'A', x: 0, y: 0, label: { placement: 'below-left' } },
        { name: 'B', x: 4, y: 0, label: { placement: 'below-right' } },
        { name: 'C', x: 0, y: 3, label: { placement: 'above-left' } },
      ],
      segments: [
        { from: 'A', to: 'B', tone: 1 },
        { from: 'A', to: 'C', tone: 2 },
        { from: 'B', to: 'C', tone: 3 },
      ],
      angleMarks: [{ vertex: 'A', from: 'B', to: 'C', right: true }],
    },
    latex: '\\tone{3}{BC}^2 = \\tone{1}{AB}^2 + \\tone{2}{AC}^2',
  },
  {
    alt: 'Rectangle 3 sur 4 + 2, partagé en deux rectangles d’aires 12 et 6.',
    spec: {
      points: [
        { name: 'P', x: 0, y: 0, ...hidden },
        { name: 'Q', x: 4, y: 0, ...hidden },
        { name: 'R', x: 6, y: 0, ...hidden },
        { name: 'S', x: 6, y: 3, ...hidden },
        { name: 'T', x: 4, y: 3, ...hidden },
        { name: 'U', x: 0, y: 3, ...hidden },
      ],
      polygons: [
        { vertices: ['P', 'Q', 'T', 'U'], tone: 1, fill: 'soft' },
        { vertices: ['Q', 'R', 'S', 'T'], tone: 2, fill: 'soft' },
        { vertices: ['P', 'R', 'S', 'U'] },
      ],
      segments: [{ from: 'Q', to: 'T' }],
      labels: [
        { text: '4', x: 2, y: 3.5, tone: 1 },
        { text: '2', x: 5, y: 3.5, tone: 2 },
        { text: '3', x: -0.5, y: 1.5 },
        { text: '12', x: 2, y: 1.5 },
        { text: '6', x: 5, y: 1.5 },
      ],
    },
    latex: '3 \\times (\\tone{1}{4} + \\tone{2}{2}) = \\tone{1}{12} + \\tone{2}{6}',
  },
]
// Three trees for the styleguide (ADR 0040): a 5e tree of possibles, a 3e weighted tree with its
// products and one highlighted path, a seconde tree with complementary events, drawn vertically.
const ARBRE_PIECES: TreeSpec = {
  root: {
    children: ['P', 'F'].map((a) => ({ label: a, children: [{ label: 'P' }, { label: 'F' }] })),
  },
  outcomes: true,
}

const ARBRE_URNE: TreeSpec = {
  root: {
    children: [
      {
        label: 'R',
        probability: '3/5',
        children: [
          { label: 'R', probability: '2/4' },
          { label: 'B', probability: '2/4' },
        ],
      },
      {
        label: 'B',
        probability: '2/5',
        children: [
          { label: 'R', probability: '3/4' },
          { label: 'B', probability: '1/4' },
        ],
      },
    ],
  },
  outcomes: true,
  products: true,
  highlightPath: ['R', 'B'],
}

const ARBRE_CONTRAIRE: TreeSpec = {
  orientation: 'vertical',
  root: {
    children: [
      {
        label: '$A$',
        probability: '0,3',
        children: [
          { label: '$B$', probability: '0,8' },
          { label: '$\\overline{B}$', probability: '0,2' },
        ],
      },
      {
        label: '$\\overline{A}$',
        probability: '0,7',
        children: [
          { label: '$B$', probability: '0,4' },
          { label: '$\\overline{B}$', probability: '?' },
        ],
      },
    ],
  },
}

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

        {/* ── Chart palette ─────────────────────────────────────────────────── */}
        <Section title="Diagrammes">
          <Label>Une couleur par catégorie, dans cet ordre — jamais pour un état</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Swatch key={n} token={`chart-${n}`} label={`chart-${n}`} />
            ))}
          </div>
        </Section>

        {/* ── Maths tones ───────────────────────────────────────────────────── */}
        <Section title="Couleurs mathématiques">
          <Label>
            Un même objet, une même teinte dans la figure et dans la formule — rare, jamais un état
          </Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex flex-col gap-2">
                <Swatch token={`tone-${n}`} label={`tone-${n}`} />
                <Swatch token={`tone-${n}-soft`} label="fond doux" />
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TONE_EXAMPLES.map((example) => (
              <Panel key={example.latex}>
                <FigureRenderer spec={example.spec} alt={example.alt} />
                <div
                  className="overflow-x-auto py-1 text-center text-ink"
                  dangerouslySetInnerHTML={{ __html: renderKatex(example.latex, true) }}
                />
              </Panel>
            ))}
          </div>
          <p className="mt-3 font-prose text-sm text-ink-muted">
            Formule : <code className="text-xs">{'\\tone{1}{AB}^2'}</code> ; figure :{' '}
            <code className="text-xs">{'"tone": 1'}</code>, plus{' '}
            <code className="text-xs">{'"fill": "soft"'}</code> sur un polygone. Au plus trois
            teintes par bloc, bleu et orange d’abord.
          </p>
        </Section>

        {/* ── Worked calculations (ADR 0042) ─────────────────────────────────── */}
        <Section title="Calcul en ligne">
          <Label>Chaîne d’égalités : aligné sur =, la partie qui change en tone-1</Label>
          <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
            <CalculRenderer
              id="demo-calcul-developper"
              spec={{
                mode: 'egalites',
                title: 'Développer $4(x + 3)$',
                lines: [
                  {
                    latex: '4(x + 3) = 4 \\times x + 4 \\times 3',
                    focus: '4 \\times',
                    note: 'on multiplie chaque terme par 4',
                  },
                  { latex: '4x + 12', note: 'on calcule chaque produit' },
                ],
              }}
            />
            <CalculRenderer
              id="demo-calcul-pythagore"
              spec={{
                mode: 'equation',
                title: 'Calculer $BC$',
                lines: [
                  { latex: 'BC^2 = AB^2 + AC^2', note: 'théorème de Pythagore' },
                  { latex: 'BC^2 = 3^2 + 4{,}5^2', focus: '4{,}5^2' },
                  { latex: 'BC^2 = 9 + 20{,}25' },
                  { latex: 'BC^2 = 29{,}25' },
                  { latex: 'BC = \\sqrt{29{,}25}', note: 'une longueur est positive' },
                  { latex: 'BC \\approx 5{,}4', note: 'au dixième' },
                ],
              }}
            />
          </div>
          <Label>Équation : l’opération sous les deux membres, ligne par ligne en mode interactif</Label>
          <CalculDemo />
        </Section>

        {/* ── Scratch palette ───────────────────────────────────────────────── */}
        <Section title="Blocs Scratch">
          <Label>Une couleur par catégorie de bloc, identique dans les deux thèmes</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SCRATCH_CATEGORIES.map(([category, label]) => (
              <Swatch key={category} token={`scratch-${category}`} label={label} />
            ))}
            <Swatch token="scratch-slot" label="Case à remplir" />
          </div>
        </Section>

        {/* ── Cube assemblages ──────────────────────────────────────────────── */}
        <Section title="Message de la Communauté">
          <Panel>
            <BlocsCommunaute
              blocs={[
                {
                  type: 'prose',
                  text: "Dans un triangle rectangle, l'==hypoténuse== est le **plus grand** côté, *toujours* opposé à l'angle droit : $BC^2 = AB^2 + AC^2$.",
                },
                { type: 'formula', latex: 'BC = \\sqrt{3^2 + 4^2} = 5' },
                {
                  type: 'list',
                  items: [
                    "Repérer l'==angle droit==.",
                    "Écrire **l'égalité** avec $BC^2$.",
                    'Calculer la racine carrée.',
                  ],
                },
                { type: 'code', language: 'python', code: 'print(3 ** 2 + 4 ** 2)' },
                {
                  type: 'code',
                  language: 'scratch',
                  code: 'mettre a à 7\nmettre a à (a * 2)\ndire (a)',
                },
              ]}
            />
          </Panel>
        </Section>

        <Section title="Éditeur de message">
          <Panel>
            <EditeurMessageDemo />
          </Panel>
        </Section>

        <Section title="Assemblages de cubes">
          <Label>Une teinte par face, du dessus (clair) au côté (foncé) — arêtes en ink</Label>
          <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-4">
            <svg viewBox="-2 -2 58 58" role="img" className="h-16 w-16 text-ink">
              <title>Un cube vu en perspective cavalière</title>
              <polygon
                points="0,14 40,14 54,0 14,0"
                className="fill-cube-top"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <polygon
                points="40,14 54,0 54,40 40,54"
                className="fill-cube-side"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <polygon
                points="0,14 40,14 40,54 0,54"
                className="fill-cube-front"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            </svg>
            <Swatch token="cube-top" label="Dessus" />
            <Swatch token="cube-front" label="Face" />
            <Swatch token="cube-side" label="Côté" />
          </div>
        </Section>

        <Section title="Arbres de probabilités">
          <Label>Arbre des possibles (5e) — issues en colonne</Label>
          <TreeRenderer
            spec={ARBRE_PIECES}
            alt="Arbre des possibles de deux lancers d’une pièce : quatre issues."
          />
          <div className="mt-8">
            <Label>Arbre pondéré (3e) — produits, un chemin mis en évidence</Label>
            <TreeRenderer
              spec={ARBRE_URNE}
              alt="Deux tirages sans remise dans une urne de 3 boules rouges et 2 bleues."
              caption="Le chemin (R ; B) : on multiplie les probabilités rencontrées."
            />
          </div>
          <div className="mt-8">
            <Label>Événements contraires (seconde) — vertical, une branche à compléter</Label>
            <TreeRenderer
              spec={ARBRE_CONTRAIRE}
              alt="Arbre vertical des événements A, non A, B et non B."
            />
          </div>
        </Section>

        <Section title="Transformations, vecteurs et droites" id="transformations">
          <Label>
            Source en ink, image en tone-1, construction en ink-muted · images et codages
            calculés (ADR 0041)
          </Label>
          <TransformationsDemo />
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
              Seuls <code>transform</code> et <code>opacity</code> s&rsquo;animent. Ce que chaque
              durée anime est décrit dans <code>docs/design/MOTION.md</code>. Si{' '}
              <code>prefers-reduced-motion</code> est actif, tout saute directement à
              l&rsquo;arrivée : en CSS par la règle de <code>tokens.css</code>, en JavaScript par{' '}
              <code>motionMs()</code>, qui renvoie 0.
            </p>
            <MotionDemo />
          </div>
        </Section>

        {/* ── Sounds ────────────────────────────────────────────────────────── */}
        <Section title="Sons">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              Mode interactif seulement, coupés par défaut : l&rsquo;élève les active dans la barre
              du haut (ou touche <code>M</code>). Synthétisés avec la Web Audio API depuis{' '}
              <code>web/lib/sound-tokens.ts</code>, sans fichier audio. Aucun son d&rsquo;échec. Ce
              qui joue quand est décrit dans <code>docs/design/MOTION.md</code>.
            </p>
            <SoundDemo />
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
              'sign-out',
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

        {/* ── Select ────────────────────────────────────────────────────────── */}
        <Section title="Liste de choix">
          <div className="flex flex-col gap-4 max-w-sm">
            <SelectInput label="Votre établissement" defaultValue="">
              <option value="">Choisir…</option>
              <option value="a">Collège pilote</option>
            </SelectInput>
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

        {/* ── Mascot ────────────────────────────────────────────────────────── */}
        <Section title="Mascotte — le caméléon Brio">
          <div className="flex flex-wrap items-end gap-8">
            <div className="flex flex-col items-center gap-2">
              <Mascot size={120} label="Brio, la mascotte" />
              <Label>calm · 120</Label>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Mascot size={120} mood="happy" label="Brio, content" />
              <Label>happy · 120</Label>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Mascot size={64} />
              <Label>décorative · 64</Label>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Mascot size={40} />
              <Label>décorative · 40</Label>
            </div>
          </div>
          <Panel raised className="mt-6">
            <p className="text-sm leading-relaxed text-ink">
              Illustration autonome, sans donnée — à poser sur le parcours / l&apos;atlas plus tard.
              Ses couleurs sont celles du personnage (maquette <code>2-parcours-atlas</code>), pas
              des tokens : une mascotte est un dessin, pas du chrome d&apos;interface.
            </p>
          </Panel>
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
