import { duration } from '@/lib/motion-tokens'

/** `--duration-slow`, read from the CSS (the token is the source); its mirror when unreadable. */
export function pauseCss(): number {
  if (typeof window === 'undefined') return duration.slow
  const brut = getComputedStyle(document.documentElement).getPropertyValue('--duration-slow').trim()
  const m = /^([\d.]+)(ms|s)$/.exec(brut)
  if (!m) return duration.slow
  return Number(m[1]) * (m[2] === 's' ? 1000 : 1)
}
