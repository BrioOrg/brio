import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// MathLive, the calculator's maths field (#417), does not run in jsdom: every test sees the plain
// text field the line shows until MathLive loads. champ-math.test.tsx brings its own fake.
vi.mock('@/components/calculatrice/mathlive', () => ({
  chargerMathLive: () => new Promise(() => undefined),
}))
