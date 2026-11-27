import type { Metadata } from 'next'

import { FileSignalements } from '@/components/prof/file-signalements'

export const metadata: Metadata = {
  title: 'Signalements d’entraide — Brio',
}

export default function SignalementsProfPage() {
  return <FileSignalements />
}
