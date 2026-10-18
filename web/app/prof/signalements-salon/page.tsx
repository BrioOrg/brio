import type { Metadata } from 'next'

import { FileSignalementsSalon } from '@/components/messagerie/file-signalements-salon'

export const metadata: Metadata = {
  title: 'Signalements du salon — Brio',
}

export default function SignalementsSalonProfPage() {
  return <FileSignalementsSalon />
}
