'use client'

import { useRef, useState } from 'react'
import { askTuteur, type TuteurReponse } from '@/lib/api'
import { useChapterInteraction } from '@/components/chapter-interaction-context'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

// Build-time config via NEXT_PUBLIC_* (inlined by Next.js bundler; changing
// the cap requires a new deploy, not just a restart).
const REQUEST_CAP = Number(process.env.NEXT_PUBLIC_TUTEUR_REQUEST_CAP) || 20

const CAP_MESSAGE =
  'Tu as atteint la limite de questions pour cette session. Demande à ton professeur si tu as besoin d’aide supplémentaire.'

type Message = { question: string; response: TuteurReponse }

type TuteurPanelProps = {
  niveau: string
  matiere: string
  slug: string
}

export function TuteurPanel({ niveau, matiere, slug }: TuteurPanelProps) {
  const { activeExerciceId } = useChapterInteraction()
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestCount, setRequestCount] = useState(0)
  const answerRegionRef = useRef<HTMLDivElement>(null)

  const capped = requestCount >= REQUEST_CAP
  const sendDisabled = question.trim() === '' || loading || capped

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (sendDisabled) return
    setError(null)
    setLoading(true)
    try {
      const response = await askTuteur(niveau, matiere, slug, question, activeExerciceId)
      setHistory((prev) => [...prev, { question, response }])
      setRequestCount((prev) => prev + 1)
      setQuestion('')
    } catch {
      setError('Erreur réseau. Réessaie dans un moment.')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e as unknown as React.FormEvent)
    }
  }

  function scrollToBlock(citation: string) {
    const blockId = citation.split('/').pop()
    if (!blockId) return
    const el = document.getElementById(blockId)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.setAttribute('data-cited', 'true')
    setTimeout(() => el.removeAttribute('data-cited'), 1500)
  }

  const remaining = REQUEST_CAP - requestCount

  return (
    <section aria-label="Tuteur">
      <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-widest text-ink-muted">
        Ton tuteur
      </p>

      {history.length > 0 && (
        <div
          ref={answerRegionRef}
          aria-live="polite"
          aria-label="Réponses du tuteur"
          className="mb-4 flex flex-col gap-3"
        >
          {history.map((msg, i) => (
            <div key={i} className="rounded-lg border border-line bg-surface-raised p-3">
              <p className="mb-2 font-prose text-xs text-ink-muted">{msg.question}</p>
              <p className="font-prose text-sm leading-relaxed text-ink">{msg.response.reponse}</p>
              {msg.response.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.response.citations.map((citation) => {
                    const blockId = citation.split('/').pop() ?? citation
                    return (
                      <button
                        key={citation}
                        type="button"
                        onClick={() => scrollToBlock(citation)}
                        className="inline-flex items-center gap-1 rounded-pill border border-info/30 bg-info/10 px-2 py-0.5 font-display text-xs font-extrabold text-info transition-colors hover:bg-info/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                      >
                        <Icon name="arrow-up-right" size={10} aria-hidden="true" />
                        {blockId}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {capped && (
        <p
          role="status"
          className="mb-3 rounded-md border border-line bg-surface-raised p-3 font-prose text-sm text-ink-muted"
        >
          {CAP_MESSAGE}
        </p>
      )}

      {error && (
        <p role="alert" className="mb-3 font-prose text-sm text-danger">
          {error}
        </p>
      )}

      {!capped && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label htmlFor="tutor-question" className="sr-only">
            Ta question au tuteur
          </label>
          <textarea
            id="tutor-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pose ta question sur ce chapitre…"
            rows={3}
            disabled={loading}
            className="w-full resize-none rounded-md border border-line bg-surface-page px-3 py-2 font-prose text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          />
          <div className="flex items-center justify-between">
            {requestCount > 0 ? (
              <p className="font-prose text-xs text-ink-muted">
                {remaining} question{remaining !== 1 ? 's' : ''} restante
                {remaining !== 1 ? 's' : ''}
              </p>
            ) : (
              <span />
            )}
            <Button type="submit" loading={loading} disabled={sendDisabled} size="sm">
              Envoyer
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
