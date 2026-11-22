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
  'scratch-pen': '#0fbd8c',
  'cube-top': '#4f7562',
  'cube-front': '#33503f',
  'cube-side': '#1f3329',
  'tone-1': '#4bb4ff',
  'tone-2': '#ff9600',
  'tone-3': '#ff4f86',
  'tone-4': '#34e3cf',
  'tone-1-soft': '#193640',
  'tone-2-soft': '#393012',
  'tone-3-soft': '#39242a',
  'tone-4-soft': '#153e37',
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
  'scratch-pen': '#0fbd8c',
  'cube-top': '#f4fbf7',
  'cube-front': '#bddbc9',
  'cube-side': '#8bb39d',
  'tone-1': '#1670c0',
  'tone-2': '#a35f00',
  'tone-3': '#9c2a78',
  'tone-4': '#0e6e46',
  'tone-1-soft': '#deebf6',
  'tone-2-soft': '#f2e9db',
  'tone-3-soft': '#f1e1ec',
  'tone-4-soft': '#ddebe5',
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
const SCRATCH_CATEGORIES = ['events', 'control', 'motion', 'looks', 'sensing', 'operators', 'variables', 'pen']
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

// Maths tones (#382, ADR 0037) colour formula text as well as strokes: body text on every ground
// a lesson block sits on. A polygon's soft fill sits under its own stroke and under ink labels.
const TONES = [1, 2, 3, 4]
function tonePairs(theme) {
  const grounds = theme === 'dark' ? ['surface-panel', 'surface-page', 'surface-raised'] : ['surface-panel', 'surface-page']
  return TONES.flatMap((n) => [
    ...grounds.map((bg) => ({ theme, fg: `tone-${n}`, bg, level: 'AA' })),
    { theme, fg: 'ink', bg: `tone-${n}-soft`, level: 'AA' },
    { theme, fg: `tone-${n}`, bg: `tone-${n}-soft`, level: 'AA-large' },
  ])
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
  ...tonePairs('dark'),

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
  ...tonePairs('light'),
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

// ── Colour-vision deficiencies ───────────────────────────────────────────────
//
// The maths tones carry a correspondence (the same side in the figure and in the formula), so they
// must stay apart for a colour-blind student too. Each colour is simulated for full protanopia,
// deuteranopia and tritanopia (Machado, Oliveira & Fernandes 2009, severity 1), then two tones are
// compared in CIELAB (ΔE*76). Protan and deutan, 8 % of boys, must keep ΔE ≥ 20; tritan, far
// rarer, ≥ 12. Colour is still never the only cue: labels name the object in both places.

const CVD = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}
const CVD_MIN_DELTA_E = { normal: 20, protan: 20, deutan: 20, tritan: 12 }

function simulatedLab(hex, matrix) {
  const rgb = [1, 3, 5].map((i) => linearise(parseInt(hex.slice(i, i + 2), 16)))
  const [r, g, b] = matrix.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])))
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

function deltaE(a, b, matrix) {
  const [l1, a1, b1] = simulatedLab(a, matrix)
  const [l2, a2, b2] = simulatedLab(b, matrix)
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

let cvdChecks = 0
for (const theme of ['dark', 'light']) {
  const tokens = theme === 'dark' ? dark : light
  for (const i of TONES) {
    for (const j of TONES.filter((n) => n > i)) {
      for (const [vision, matrix] of Object.entries(CVD)) {
        const delta = deltaE(tokens[`tone-${i}`], tokens[`tone-${j}`], matrix)
        const required = CVD_MIN_DELTA_E[vision]
        const line = `  ${delta >= required ? '✓' : '✗'} [${theme}] tone-${i} vs tone-${j}, ${vision} — ΔE ${delta.toFixed(1).padStart(5)}  (≥ ${required})`
        cvdChecks++
        if (delta >= required) {
          process.stdout.write(line + '\n')
        } else {
          process.stderr.write(line + '\n')
          failures++
        }
      }
    }
  }
}

if (failures > 0) {
  process.stderr.write(`\n${failures} contrast or colour-vision failure(s). Fix the values in web/app/tokens.css.\n`)
  process.exit(1)
} else {
  process.stdout.write(`\nAll ${pairs.length} contrast pairs and ${cvdChecks} colour-vision checks pass.\n`)
}
