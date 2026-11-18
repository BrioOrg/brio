import { describe, expect, it } from 'vitest'
import { checkSolid } from '../solid-rules'

const square = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
]

describe('checkSolid', () => {
  it('should accept a valid solid of each kind', () => {
    const valid = [
      { kind: 'pave', width: 4, height: 3, depth: 2, section: { parallelTo: 'front', at: 1 } },
      { kind: 'cube', edge: 3, names: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
      { kind: 'prisme', base: square.slice(0, 3), depth: 2, section: { at: 1 } },
      { kind: 'cylindre', radius: 2, height: 4, section: { parallelTo: 'axis', at: 0 } },
      { kind: 'pyramide', base: square, height: 4, apex: { x: 0, y: 0 } },
      { kind: 'cone', radius: 2, height: 4, names: ['O', 'S'], section: { at: 1 } },
      {
        kind: 'boule',
        radius: 3,
        names: ['O'],
        equator: true,
        parallels: [45, -30],
        meridians: [0, 180],
        points: [{ name: 'M', latitude: 90, longitude: -180 }],
        section: { at: -2 },
      },
    ]
    for (const block of valid) expect(checkSolid(block)).toEqual([])
  })

  it('should reject an unknown kind and stop there', () => {
    expect(checkSolid({ kind: 'tore' })).toEqual([
      { code: 'UNKNOWN_KIND', path: 'kind', kind: 'tore' },
    ])
  })

  it('should require positive dimensions', () => {
    expect(checkSolid({ kind: 'cone', radius: 0, height: 2 })).toEqual([
      { code: 'DIMENSION_NOT_POSITIVE', path: 'radius', field: 'radius' },
    ])
  })

  it('should require a convex base of 3 to 12 vertices', () => {
    expect(checkSolid({ kind: 'pyramide', base: square.slice(0, 2), height: 2 })[0].code).toBe(
      'BASE_SIZE'
    )
    const bowtie = [square[0], square[2], square[1], square[3]]
    expect(checkSolid({ kind: 'pyramide', base: bowtie, height: 2 })[0].code).toBe(
      'BASE_NOT_CONVEX'
    )
    const star = [0, 1, 2, 3, 4].map((k) => ({
      x: Math.cos((k * 4 * Math.PI) / 5),
      y: Math.sin((k * 4 * Math.PI) / 5),
    }))
    expect(checkSolid({ kind: 'prisme', base: star, depth: 2 })[0].code).toBe('BASE_NOT_CONVEX')
  })

  it('should count the names: vertices, then the apex or the centres', () => {
    expect(
      checkSolid({ kind: 'pyramide', base: square, height: 2, names: ['A', 'B', 'C', 'D'] })
    ).toEqual([{ code: 'NAMES_COUNT', path: 'names', kind: 'pyramide', expected: 5, count: 4 }])
  })

  it('should reject blank and repeated names, points of a sphere included', () => {
    expect(
      checkSolid({
        kind: 'boule',
        radius: 1,
        names: ['O'],
        points: [
          { name: 'O', latitude: 0, longitude: 0 },
          { name: ' ', latitude: 0, longitude: 0 },
        ],
      }).map((i) => i.code)
    ).toEqual(['DUPLICATE_NAME', 'BLANK_NAME'])
  })

  it('should keep the sphere fields to a ball', () => {
    expect(checkSolid({ kind: 'cube', edge: 1, equator: true })).toEqual([
      { code: 'SPHERE_ONLY_FIELD', path: 'equator', field: 'equator' },
    ])
  })

  it('should bound latitudes and longitudes; a parallel is never a pole', () => {
    const codes = checkSolid({
      kind: 'boule',
      radius: 1,
      parallels: [90],
      meridians: [200],
      points: [{ name: 'M', latitude: -91, longitude: 0 }],
    }).map((i) => i.code)
    expect(codes).toEqual([
      'LATITUDE_OUT_OF_RANGE',
      'LONGITUDE_OUT_OF_RANGE',
      'LATITUDE_OUT_OF_RANGE',
    ])
  })

  it('should accept only the section planes of each kind', () => {
    expect(
      checkSolid({ kind: 'cone', radius: 1, height: 2, section: { parallelTo: 'front', at: 1 } })
    ).toEqual([{ code: 'SECTION_PLANE', path: 'section.parallelTo', kind: 'cone', plane: 'front' }])
    expect(
      checkSolid({ kind: 'boule', radius: 1, section: { parallelTo: 'base', at: 0 } })[0].code
    ).toBe('SECTION_PLANE')
  })

  it('should keep a section strictly inside the solid', () => {
    expect(checkSolid({ kind: 'pave', width: 4, height: 3, depth: 2, section: { at: 3 } })).toEqual(
      [
        {
          code: 'SECTION_OUT_OF_RANGE',
          path: 'section.at',
          at: 3,
          min: 0,
          max: 3,
          minIncluded: false,
        },
      ]
    )
    expect(checkSolid({ kind: 'boule', radius: 2, section: { at: -2 } })[0].code).toBe(
      'SECTION_OUT_OF_RANGE'
    )
    expect(
      checkSolid({
        kind: 'cylindre',
        radius: 2,
        height: 3,
        section: { parallelTo: 'axis', at: 2 },
      })[0].code
    ).toBe('SECTION_OUT_OF_RANGE')
  })
})
