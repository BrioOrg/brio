export const PROBABILITY_EXPERIMENT_IDS = ['coin', 'die', 'urn'] as const

export type ProbabilityExperiment = (typeof PROBABILITY_EXPERIMENT_IDS)[number]

type Experiment = {
  label: string
  description: string
  outcomes: ReadonlyArray<{ label: string; weight: number }>
}

export const PROBABILITY_EXPERIMENTS: Record<ProbabilityExperiment, Experiment> = {
  coin: {
    label: 'Pièce équilibrée',
    description: 'Pile et face ont autant de chances de sortir.',
    outcomes: [
      { label: 'Pile', weight: 1 },
      { label: 'Face', weight: 1 },
    ],
  },
  die: {
    label: 'Dé à six faces',
    description: 'Les six faces du dé ont autant de chances de sortir.',
    outcomes: Array.from({ length: 6 }, (_, index) => ({ label: String(index + 1), weight: 1 })),
  },
  urn: {
    label: 'Urne avec remise',
    description:
      'L’urne contient 3 boules rouges et 2 bleues. Chaque boule tirée est remise dans l’urne.',
    outcomes: [
      { label: 'Rouge', weight: 3 },
      { label: 'Bleue', weight: 2 },
    ],
  },
}

export function simulateExperiment(experiment: ProbabilityExperiment, trials: number): number[] {
  const { outcomes } = PROBABILITY_EXPERIMENTS[experiment]
  const tickets = outcomes.flatMap(({ weight }, index) =>
    Array.from({ length: weight }, () => index)
  )
  const counts = outcomes.map(() => 0)

  for (let trial = 0; trial < trials; trial++) {
    const outcome = tickets[Math.floor(Math.random() * tickets.length)]
    counts[outcome]++
  }

  return counts
}
