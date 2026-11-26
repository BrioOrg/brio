import { z } from 'zod'

import { PROBABILITY_EXPERIMENT_IDS } from '@/lib/probability-simulator'

export const ProbabilityExperimentSchema = z.enum(PROBABILITY_EXPERIMENT_IDS)

export const ProbabilityBlockSchema = z.object({
  id: z.string(),
  type: z.literal('simulateur-probabilites'),
  experiment: ProbabilityExperimentSchema,
  consigne: z.string().optional(),
})
