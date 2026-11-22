import type { Metadata } from 'next'

import { ConsoleModeration } from '@/components/admin/console-moderation'

export const metadata: Metadata = {
  title: 'Modération Communauté — Brio',
}

export default function ModerationCommunautePage() {
  return <ConsoleModeration />
}
