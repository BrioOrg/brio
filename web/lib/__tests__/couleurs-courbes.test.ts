import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  COURBE_BG,
  COURBE_FILL,
  COURBE_STROKE,
  COURBE_TEXT,
  type CouleurCourbe,
} from '../couleurs-courbes'

const css = readFileSync(resolve(__dirname, '../../app/tokens.css'), 'utf8')
const sourceInline = /@source inline\("([^"]*)"\)/.exec(css)?.[1]?.split(/\s+/) ?? []

const CURVES: CouleurCourbe[] = [1, 2, 3, 4, 5, 6]
const FAMILIES = [
  ['stroke', COURBE_STROKE],
  ['fill', COURBE_FILL],
  ['bg', COURBE_BG],
  ['text', COURBE_TEXT],
] as const

describe('curve colour classes', () => {
  it.each(FAMILIES)('should name the %s class of each of the six curves', (prefix, classes) => {
    expect(Object.keys(classes)).toHaveLength(6)
    for (const n of CURVES) expect(classes[n]).toBe(`${prefix}-courbe-${n}`)
  })

  it.each(FAMILIES)('should declare every %s class to Tailwind in @source inline', (_, classes) => {
    for (const n of CURVES) expect(sourceInline).toContain(classes[n])
  })
})
