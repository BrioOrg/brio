'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  listLessonWrittenExercises,
  type WrittenExerciseLesson,
  type WrittenExerciseSummary,
} from '@/lib/exercices-rediges'

export function LessonWrittenExercises({ lesson }: { lesson: WrittenExerciseLesson }) {
  const key =
    'coursId' in lesson ? lesson.coursId : `${lesson.niveau}/${lesson.matiere}/${lesson.slug}`
  return <ExerciseLinks key={key} lesson={lesson} />
}

function ExerciseLinks({ lesson }: { lesson: WrittenExerciseLesson }) {
  const [exercises, setExercises] = useState<WrittenExerciseSummary[]>([])
  const coursId = 'coursId' in lesson ? lesson.coursId : undefined
  const niveau = 'niveau' in lesson ? lesson.niveau : undefined
  const matiere = 'matiere' in lesson ? lesson.matiere : undefined
  const slug = 'slug' in lesson ? lesson.slug : undefined

  useEffect(() => {
    const source = coursId
      ? { coursId }
      : niveau && matiere && slug
        ? { niveau, matiere, slug }
        : null
    if (!source) return
    const controller = new AbortController()
    void listLessonWrittenExercises(source, controller.signal)
      .then(setExercises)
      // The exercise panel is optional. A failed request must not disrupt lesson reading.
      .catch(() => {})
    return () => controller.abort()
  }, [coursId, niveau, matiere, slug])

  if (exercises.length === 0) return null

  return (
    <nav
      aria-label="Exercices rédigés"
      className="mb-4 rounded-lg border border-line bg-surface-panel px-4 py-3"
    >
      <p aria-hidden="true" className="font-display text-sm font-extrabold text-ink">
        Exercices rédigés
      </p>
      <ul className="flex flex-wrap gap-x-4">
        {exercises.map(({ id, titre }) => (
          <li key={id}>
            <Link
              href={`/exercices-rediges/${id}`}
              className="inline-flex min-h-11 items-center rounded-sm font-prose text-sm font-semibold text-accent-ink underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {titre}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
