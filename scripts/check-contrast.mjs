#!/usr/bin/env node
/**
 * WCAG contrast checker for brio semantic token pairs.
 *
 * Checks the pairs most at risk (muted-on-panel, accent-on-dark) in both
 * themes. Exits non-zero on any failure so CI can gate on it.
 *
 * Standard: WCAG 2.1 §1.4.3
 *   AA normal text : contrast ratio ≥ 4.5 : 1
 *   AA large text  : contrast ratio ≥ 3.0 : 1  (18pt / 14pt bold)
 */

// ── WCAG luminance ──────────────────────────────────────────────────────────

function linearise(channel) {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
}

function contrast(fg, bg) {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Token values ─────────────────────────────────────────────────────────────
// Keep in sync with web/app/tokens.css.

const dark = {
  'surface-page': '#0a1310',
  'surface-panel': '#0e1a16',
  'surface-raised': '#14271d',
  ink: '#eafff3',
  'ink-muted': '#85a093',
  line: '#1a2a22',
  accent: '#17c26b',
  'accent-hi': '#3ce088',
  'accent-edge': '#0b7a43',
  'accent-soft': '#14271d',
  'accent-ink': '#86f0b1',
  success: '#17c26b',
  danger: '#e86060',
  warning: '#f0a83a',
  info: '#4bb4ff',
  'feedback-incorrect': '#f0a83a',
  'feedback-incorrect-edge': '#b5730a',
  xp: '#ffcf3f',
  streak: '#ff9600',
  'chart-1': '#17c26b',
  'chart-2': '#4bb4ff',
  'chart-3': '#f0a83a',
  'chart-4': '#b99bff',
  'chart-5': '#ff7aa8',
  'chart-6': '#c9d4ce',
  'scratch-ink': '#10241a',
  'scratch-slot': '#ffffff',
  'scratch-events': '#ffbf00',
  'scratch-control': '#ffab19',
  'scratch-motion': '#4c97ff',
  'scratch-looks': '#a375ff',
  'scratch-sensing': '#5cb1d6',
  'scratch-operators': '#59c059',
  'scratch-variables': '#ff8c1a',
  'cube-top': '#4f7562',
  'cube-front': '#33503f',
  'cube-side': '#1f3329',
}

const light = {
  'surface-page': '#eaf7ef',
  'surface-panel': '#ffffff',
  'surface-raised': '#ffffff',
  ink: '#10241a',
  'ink-muted': '#5c7568',
  line: '#dfeae3',
  accent: '#0d9a5a',
  'accent-hi': '#17c26b',
  'accent-edge': '#0a7a45',
  'accent-soft': '#d9f3e8',
  'accent-ink': '#0a7a45',
  success: '#0d9a5a',
  danger: '#c93535',
  warning: '#b87a00',
  info: '#1a80d4',
  'feedback-incorrect': '#b87a00',
  'feedback-incorrect-edge': '#7a4f00',
  xp: '#b88000',
  streak: '#d97000',
  'chart-1': '#0d9a5a',
  'chart-2': '#1a80d4',
  'chart-3': '#b87a00',
  'chart-4': '#6b40cc',
  'chart-5': '#c2185b',
  'chart-6': '#6b7a72',
  'scratch-ink': '#10241a',
  'scratch-slot': '#ffffff',
  'scratch-events': '#ffbf00',
  'scratch-control': '#ffab19',
  'scratch-motion': '#4c97ff',
  'scratch-looks': '#a375ff',
  'scratch-sensing': '#5cb1d6',
  'scratch-operators': '#59c059',
  'scratch-variables': '#ff8c1a',
  'cube-top': '#f4fbf7',
  'cube-front': '#bddbc9',
  'cube-side': '#8bb39d',
}

// ── Pairs to check ───────────────────────────────────────────────────────────
//
// Format: [foreground-token, background-token, level]
//   level "AA"       → 4.5 : 1 (body text)
//   level "AA-large" → 3.0 : 1 (large text / graphical elements)
//   level "step"     → 1.3 : 1 (two adjacent fills that must read apart; not a WCAG level)

// Chart fills are graphics, never text: 3 : 1 against both grounds a chart can sit on (#216).
function chartPairs(theme) {
  return [1, 2, 3, 4, 5, 6].flatMap((n) =>
    ['surface-panel', 'surface-page'].map((bg) => ({ theme, fg: `chart-${n}`, bg, level: 'AA-large' }))
  )
}

// Scratch blocks carry text: their label (scratch-ink) is body text on every category fill and
// on the input ovals (#217). The values are the same in both themes.
const SCRATCH_CATEGORIES = ['events', 'control', 'motion', 'looks', 'sensing', 'operators', 'variables']
function scratchPairs(theme) {
  return [...SCRATCH_CATEGORIES.map((c) => `scratch-${c}`), 'scratch-slot'].map((bg) => ({
    theme,
    fg: 'scratch-ink',
    bg,
    level: 'AA',
  }))
}

// Cube assemblages are graphics: their edges (ink) clear 3 : 1 on every face (#226). Two faces
// that meet must also read apart, or the volume flattens: a step of at least 1.3 : 1.
function cubePairs(theme) {
  return [
    ...['top', 'front', 'side'].map((face) => ({ theme, fg: 'ink', bg: `cube-${face}`, level: 'AA-large' })),
    { theme, fg: 'cube-top', bg: 'cube-front', level: 'step' },
    { theme, fg: 'cube-front', bg: 'cube-side', level: 'step' },
  ]
}

const pairs = [
  // Dark theme
  { theme: 'dark', fg: 'ink', bg: 'surface-panel', level: 'AA' },
  { theme: 'dark', fg: 'ink', bg: 'surface-page', level: 'AA' },
  { theme: 'dark', fg: 'ink-muted', bg: 'surface-panel', level: 'AA' },
  { theme: 'dark', fg: 'ink-muted', bg: 'surface-page', level: 'AA' },
  { theme: 'dark', fg: 'accent', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'dark', fg: 'accent', bg: 'surface-page', level: 'AA-large' },
  { theme: 'dark', fg: 'accent-ink', bg: 'surface-raised', level: 'AA' },
  { theme: 'dark', fg: 'danger', bg: 'surface-panel', level: 'AA' },
  { theme: 'dark', fg: 'warning', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'dark', fg: 'feedback-incorrect', bg: 'surface-raised', level: 'AA-large' },
  { theme: 'dark', fg: 'info', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'dark', fg: 'xp', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'dark', fg: 'streak', bg: 'surface-panel', level: 'AA-large' },
  ...chartPairs('dark'),
  ...scratchPairs('dark'),
  ...cubePairs('dark'),

  // Light theme
  { theme: 'light', fg: 'ink', bg: 'surface-panel', level: 'AA' },
  { theme: 'light', fg: 'ink', bg: 'surface-page', level: 'AA' },
  { theme: 'light', fg: 'ink-muted', bg: 'surface-panel', level: 'AA' },
  { theme: 'light', fg: 'ink-muted', bg: 'surface-page', level: 'AA' },
  { theme: 'light', fg: 'accent', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'light', fg: 'accent', bg: 'surface-page', level: 'AA-large' },
  { theme: 'light', fg: 'accent-edge', bg: 'surface-panel', level: 'AA' },
  { theme: 'light', fg: 'accent-edge', bg: 'surface-page', level: 'AA' },
  { theme: 'light', fg: 'danger', bg: 'surface-panel', level: 'AA' },
  { theme: 'light', fg: 'danger', bg: 'surface-page', level: 'AA' },
  { theme: 'light', fg: 'warning', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'light', fg: 'feedback-incorrect', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'light', fg: 'info', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'light', fg: 'info', bg: 'surface-page', level: 'AA-large' },
  { theme: 'light', fg: 'xp', bg: 'surface-panel', level: 'AA-large' },
  { theme: 'light', fg: 'streak', bg: 'surface-panel', level: 'AA-large' },
  ...chartPairs('light'),
  ...scratchPairs('light'),
  ...cubePairs('light'),
]

// ── Run checks ───────────────────────────────────────────────────────────────

const THRESHOLD = { AA: 4.5, 'AA-large': 3.0, step: 1.3 }

let failures = 0

for (const { theme, fg, bg, level } of pairs) {
  const tokens = theme === 'dark' ? dark : light
  const fgHex = tokens[fg]
  const bgHex = tokens[bg]
  const ratio = contrast(fgHex, bgHex)
  const required = THRESHOLD[level]
  const pass = ratio >= required

  const status = pass ? '✓' : '✗'
  const ratioStr = ratio.toFixed(2).padStart(5)
  const line = `  ${status} [${theme}] ${fg} on ${bg} — ${ratioStr} : 1  (${level} ≥ ${required})`

  if (pass) {
    process.stdout.write(line + '\n')
  } else {
    process.stderr.write(line + '\n')
    failures++
  }
}

if (failures > 0) {
  process.stderr.write(`\n${failures} contrast failure(s). Fix the values in web/app/tokens.css.\n`)
  process.exit(1)
} else {
  process.stdout.write(`\nAll ${pairs.length} contrast pairs pass.\n`)
}
