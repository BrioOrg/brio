import type { Metadata } from 'next'

import { FileSignalements } from '@/components/prof/file-signalements'

export const metadata: Metadata = {
  title: 'Signalements — Brio',
}

export default function SignalementsProfPage() {
  return <FileSignalements />
}
