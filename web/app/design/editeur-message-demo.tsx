'use client'

import { useState } from 'react'

import { EditeurMessage, type MessageEcrit } from '@/components/communaute/editeur-message'

/** The composer on its own: nothing is sent, the demo shows what the API would receive. */
export function EditeurMessageDemo() {
  const [ecrit, setEcrit] = useState<MessageEcrit | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <EditeurMessage mode="question" onEnvoyer={setEcrit} />
      {ecrit && (
        <pre
          aria-label="Message produit"
          className="overflow-x-auto rounded-md border border-line bg-surface-raised p-4 font-mono text-xs text-ink"
        >
          {JSON.stringify(ecrit, null, 2)}
        </pre>
      )}
    </div>
  )
}
