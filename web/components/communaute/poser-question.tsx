'use client'

import { poserQuestion } from '@brio/api-client'
import { useRouter } from 'next/navigation'

import { EditeurMessage, type MessageEcrit } from '@/components/communaute/editeur-message'
import { apiBaseUrl } from '@/lib/api-base-url'

/** Publishes the question, then opens its thread. A rejection stays in the composer. */
export function PoserQuestion() {
  const router = useRouter()

  async function publier({ titre, corps }: MessageEcrit) {
    const id = await poserQuestion(apiBaseUrl(), { titre: titre ?? '', corps })
    router.push(`/communaute/${id}`)
  }

  return (
    <EditeurMessage
      mode="question"
      onEnvoyer={publier}
      onAnnuler={() => router.push('/communaute')}
    />
  )
}
