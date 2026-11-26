import type { Metadata } from 'next'

import { WrittenExerciseBuilder } from '@/components/exercices-rediges/written-exercise-builder'

export const metadata: Metadata = {
  title: 'Exercices rédigés — Brio',
}

export default function TeacherWrittenExercisesPage() {
  return <WrittenExerciseBuilder />
}
