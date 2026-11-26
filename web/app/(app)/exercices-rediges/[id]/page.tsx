import 'katex/dist/katex.min.css'

import Link from 'next/link'
import { cookies } from 'next/headers'

import { WrittenExerciseReader } from '@/components/exercices-rediges/written-exercise-reader'
import { SiteHeader } from '@/components/site-header'
import {
  getWrittenExercise,
  writtenExerciseErrorMessage,
  writtenExerciseLessonHref,
} from '@/lib/exercices-rediges'

export const dynamic = 'force-dynamic'

export default async function WrittenExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookie = (await cookies()).toString()

  const result = await getWrittenExercise(id, cookie).then(
    (exercise) => ({ exercise, error: null }),
    (error: unknown) => ({
      exercise: null,
      error: writtenExerciseErrorMessage(
        error,
        'Impossible de charger cet exercice pour le moment.'
      ),
    })
  )
  if (!result.exercise) {
    return (
      <>
        <SiteHeader crumbs={[{ label: 'Exercice rédigé' }]} />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
          <h1 className="font-display text-2xl font-black text-ink">Exercice rédigé</h1>
          <p role="alert" className="font-prose text-base text-ink">
            {result.error}
          </p>
          <Link href="/explorer" className="font-semibold text-accent-ink underline">
            Retour à Explorer
          </Link>
        </main>
      </>
    )
  }

  const exercise = result.exercise
  const lessonHref = writtenExerciseLessonHref(exercise)
  return (
    <>
      <SiteHeader crumbs={[{ label: 'Leçon', href: lessonHref }, { label: 'Exercice rédigé' }]} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <Link
          href={lessonHref}
          className="inline-flex min-h-11 items-center rounded-sm font-prose text-sm font-semibold text-accent-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Retour à la leçon
        </Link>
        <h1 className="font-display text-3xl font-black tracking-tight text-ink">
          {exercise.titre}
        </h1>
        <WrittenExerciseReader
          key={`${exercise.id}:${exercise.version}`}
          initialExercise={exercise}
        />
      </main>
    </>
  )
}
