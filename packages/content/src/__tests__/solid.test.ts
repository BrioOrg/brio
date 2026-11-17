import { describe, expect, it } from 'vitest'
import {
  buildSolidGeometry,
  clampView,
  coastView,
  dragView,
  interpolateView,
  projectSolid,
  sameView,
  solidStrokes,
  solidSphereRuns,
  stepView,
  SOLID_INITIAL_VIEW,
  SOLID_SIZE,
  type SolidSpec,
  type SolidView,
} from '../solid'

const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const pave: SolidSpec = { kind: 'pave', width: 4, height: 3, depth: 2, names: NAMES }

/** Hidden edges of a polyhedron in a view, as "AE"-style names sorted. */
function hiddenEdges(spec: SolidSpec, view: SolidView, names: string[] = NAMES): string[] {
  const g = buildSolidGeometry(spec)
  return solidStrokes(g, view)
    .filter((s) => s.layer === 'edge' && !s.visible)
    .map((s) => [names[s.a], names[s.b]].sort().join(''))
    .sort()
}

describe('buildSolidGeometry and solidStrokes', () => {
  it('should hide the three edges at E in the textbook view of a pavé, like the cavalière figure', () => {
    expect(hiddenEdges(pave, SOLID_INITIAL_VIEW)).toEqual(['AE', 'EF', 'EH'])
  })

  it('should hide other edges once the pavé is turned to be seen from behind and below', () => {
    // Seen from the back left, a little from below: the hidden vertex is now C, top front right.
    expect(hiddenEdges(pave, { yaw: 160, pitch: -20 })).toEqual(['BC', 'CD', 'CG'])
  })

  it('should keep exactly three hidden edges in any generic view of a cube', () => {
    const cube: SolidSpec = { kind: 'cube', edge: 2, names: NAMES }
    for (const view of [
      { yaw: 10, pitch: 30 },
      { yaw: -100, pitch: -50 },
      { yaw: 170, pitch: 5 },
    ]) {
      expect(hiddenEdges(cube, view)).toHaveLength(3)
    }
  })

  it('should hide the back edges of a pyramid with a square base', () => {
    const pyramide: SolidSpec = {
      kind: 'pyramide',
      base: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      height: 4,
      names: ['A', 'B', 'C', 'D', 'S'],
    }
    expect(hiddenEdges(pyramide, SOLID_INITIAL_VIEW, ['A', 'B', 'C', 'D', 'S'])).toEqual([
      'AD',
      'CD',
      'DS',
    ])
  })

  it('should draw two outline generators of a cylinder and dash the back half of its lower base', () => {
    const g = buildSolidGeometry({ kind: 'cylindre', radius: 2, height: 4 })
    const strokes = solidStrokes(g, SOLID_INITIAL_VIEW)
    const generators = strokes.filter((s) => Math.abs(s.b - s.a) === 64)
    expect(generators).toHaveLength(2)
    expect(generators.every((s) => s.visible)).toBe(true)
    const lowerRing = strokes.filter((s) => s.a < 64 && s.b < 64)
    expect(lowerRing.filter((s) => !s.visible)).toHaveLength(32)
  })

  it('should draw no outline generator when a cylinder is seen straight from above', () => {
    const g = buildSolidGeometry({ kind: 'cylindre', radius: 2, height: 4 })
    const generators = solidStrokes(g, { yaw: 0, pitch: 90 }).filter(
      (s) => Math.abs(s.b - s.a) === 64
    )
    expect(generators).toEqual([])
  })

  it('should cut a pavé parallel to its base into a rectangle, front edges seen, back ones hidden', () => {
    const g = buildSolidGeometry({ ...pave, section: { parallelTo: 'base', at: 1 } })
    expect(g.section).toHaveLength(4)
    for (const i of g.section ?? []) expect(g.points[i].z).toBeCloseTo(1)
    const section = solidStrokes(g, SOLID_INITIAL_VIEW).filter((s) => s.layer === 'section')
    expect(section).toHaveLength(4)
    // On the front and right faces: seen; on the back and left faces: hidden.
    expect(section.filter((s) => s.visible)).toHaveLength(2)
  })

  it('should cut a cone parallel to its base into a reduced circle', () => {
    const g = buildSolidGeometry({ kind: 'cone', radius: 2, height: 4, section: { at: 2 } })
    const radii = (g.section ?? []).map((i) => Math.hypot(g.points[i].x, g.points[i].y))
    expect(radii.length).toBe(64)
    // Half-way up, the radius is halved (a polygon inscribed in the circle of radius 1).
    for (const r of radii) {
      expect(r).toBeGreaterThan(0.99)
      expect(r).toBeLessThanOrEqual(1 + 1e-9)
    }
  })

  it('should cut a ball at distance d from its centre into a circle of radius √(r² − d²)', () => {
    const g = buildSolidGeometry({ kind: 'boule', radius: 5, section: { at: 3 } })
    for (const i of g.section ?? []) {
      expect(Math.hypot(g.points[i].x, g.points[i].y)).toBeCloseTo(4)
      expect(g.points[i].z).toBeCloseTo(3)
    }
  })

  it('should place a point of a sphere by latitude and longitude, 0° facing the viewer', () => {
    const g = buildSolidGeometry({
      kind: 'boule',
      radius: 2,
      points: [
        { name: 'M', latitude: 0, longitude: 0 },
        { name: 'N', latitude: 90, longitude: 0 },
        { name: 'E', latitude: 0, longitude: 90 },
      ],
    })
    const at = (name: string) => g.points[g.named.find((n) => n.name === name)!.point]
    expect(at('M').y).toBeCloseTo(-2)
    expect(at('N').z).toBeCloseTo(2)
    expect(at('E').x).toBeCloseTo(2)
  })

  it('should dim a point of a sphere on its far side', () => {
    const g = buildSolidGeometry({
      kind: 'boule',
      radius: 2,
      points: [{ name: 'P', latitude: 0, longitude: 180 }],
    })
    const front = projectSolid(g, { yaw: 0, pitch: 0 })
    expect(front.dots).toBe('')
    expect(front.hiddenDots).not.toBe('')
    const back = projectSolid(g, { yaw: 180, pitch: 0 })
    expect(back.dots).not.toBe('')
  })

  it('should fit every view inside the frame', () => {
    const g = buildSolidGeometry(pave)
    for (const view of [SOLID_INITIAL_VIEW, { yaw: 45, pitch: 35 }, { yaw: 120, pitch: -60 }]) {
      const numbers = projectSolid(g, view)
        .visible.match(/-?\d+(\.\d+)?/g)!
        .map(Number)
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(0)
        expect(n).toBeLessThanOrEqual(SOLID_SIZE)
      }
    }
  })

  it('should give one label per name, in the same order in every view', () => {
    const g = buildSolidGeometry(pave)
    const a = projectSolid(g, SOLID_INITIAL_VIEW).labels.map((l) => l.text)
    const b = projectSolid(g, { yaw: 90, pitch: -40 }).labels.map((l) => l.text)
    expect(a).toEqual(NAMES)
    expect(b).toEqual(NAMES)
  })

  it('should put the apex of a pyramid seen from the front above its point', () => {
    const g = buildSolidGeometry({
      kind: 'pyramide',
      base: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 1.5, y: 2.5 },
      ],
      height: 4,
      names: ['A', 'B', 'C', 'S'],
    })
    const frame = projectSolid(g, SOLID_INITIAL_VIEW)
    const apexY = Math.min(...frame.visible.match(/ (\d+(\.\d+)?)/g)!.map(Number))
    expect(frame.labels[3].y).toBeLessThan(apexY)
  })

  it('should keep every name clear of every stroke, in any view', () => {
    const pyramide = buildSolidGeometry({
      kind: 'pyramide',
      base: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      height: 4,
      names: ['A', 'B', 'C', 'D', 'S'],
      section: { at: 2 },
    })
    for (const view of [SOLID_INITIAL_VIEW, { yaw: 40, pitch: 30 }, { yaw: -130, pitch: -25 }]) {
      const frame = projectSolid(pyramide, view)
      const strokes = (frame.visible + frame.hidden + frame.sectionVisible + frame.sectionHidden)
        .split('M')
        .filter(Boolean)
        .flatMap((sub) => {
          const pts = sub
            .replace('Z', '')
            .split('L')
            .map((p) => p.split(' ').map(Number))
          return pts.slice(1).map((p, i) => [pts[i], p])
        })
      for (const label of frame.labels) {
        const clearance = Math.min(
          ...strokes.map(([a, b]) => {
            const dx = b[0] - a[0]
            const dy = b[1] - a[1]
            const l2 = dx * dx + dy * dy || 1
            const t = Math.max(0, Math.min(1, ((label.x - a[0]) * dx + (label.y - a[1]) * dy) / l2))
            return Math.hypot(label.x - a[0] - t * dx, label.y - a[1] - t * dy)
          })
        )
        // The centre of a 13 px capital: half its height clear of any stroke.
        expect(clearance, `${label.text} at yaw ${view.yaw}`).toBeGreaterThan(5)
      }
    }
  })

  it('should draw the axis of a named cylinder dashed, from O to O′', () => {
    const g = buildSolidGeometry({ kind: 'cylindre', radius: 1, height: 2, names: ['O', 'O′'] })
    const frame = projectSolid(g, SOLID_INITIAL_VIEW)
    expect(frame.labels.map((l) => l.text)).toEqual(['O', 'O′'])
    expect(frame.dots.match(/M/g)).toHaveLength(2)
  })

  it('should fail with a readable message on an impossible solid', () => {
    expect(() => buildSolidGeometry({ kind: 'cone', radius: 0, height: 2 })).toThrow(/rayon/)
  })
})

describe('curves on a sphere', () => {
  const sphere = buildSolidGeometry({
    kind: 'boule',
    radius: 3,
    equator: true,
    parallels: [45, -60],
    meridians: [0, 60],
    section: { at: 1.5 },
  })
  const views = [
    SOLID_INITIAL_VIEW,
    { yaw: -7, pitch: 35 },
    { yaw: 70, pitch: -40 },
    { yaw: 0, pitch: 90 },
    { yaw: 150, pitch: -89 },
  ]

  it('should draw each meridian as a whole great circle, its far half dashed', () => {
    const runs = solidSphereRuns(sphere, SOLID_INITIAL_VIEW).filter((r) => r.layer === 'edge')
    // Equator, two parallels, two meridians: seen from a little above, each crosses the outline
    // twice, so each has one seen and one dashed part.
    expect(runs.filter((r) => r.visible)).toHaveLength(5)
    expect(runs.filter((r) => !r.visible)).toHaveLength(5)
    expect(runs.every((r) => r.cutAtStart && r.cutAtEnd)).toBe(true)
  })

  it('should cut every curve exactly on the outline, never leaving a short stray piece', () => {
    const half = SOLID_SIZE / 2
    const r = 3 * sphere.scale
    for (const view of views) {
      for (const run of solidSphereRuns(sphere, view)) {
        const ends = [
          run.cutAtStart ? run.points[0] : null,
          run.cutAtEnd ? run.points[run.points.length - 1] : null,
        ]
        for (const p of ends) {
          if (p) expect(Math.abs(Math.hypot(p.x - half, p.y - half) - r)).toBeLessThan(0.5)
        }
        let length = 0
        for (let i = 1; i < run.points.length; i++) {
          length += Math.hypot(
            run.points[i].x - run.points[i - 1].x,
            run.points[i].y - run.points[i - 1].y
          )
        }
        expect(length, `run at ${JSON.stringify(view)}`).toBeGreaterThan(1)
      }
    }
  })

  it('should never turn sharply along a curve (no cusp)', () => {
    for (const view of views) {
      for (const run of solidSphereRuns(sphere, view)) {
        const p = run.points
        for (let i = 2; i < p.length; i++) {
          const u = { x: p[i - 1].x - p[i - 2].x, y: p[i - 1].y - p[i - 2].y }
          const v = { x: p[i].x - p[i - 1].x, y: p[i].y - p[i - 1].y }
          const lu = Math.hypot(u.x, u.y)
          const lv = Math.hypot(v.x, v.y)
          if (lu < 0.05 || lv < 0.05) continue
          // Consecutive pieces of a projected circle never fold back on each other.
          expect((u.x * v.x + u.y * v.y) / (lu * lv)).toBeGreaterThan(-0.5)
        }
      }
    }
  })
})

describe('views', () => {
  it('should turn right and show the top when dragged right and down', () => {
    const v = dragView({ yaw: 0, pitch: 0 }, 20, 10)
    expect(v.yaw).toBeGreaterThan(0)
    expect(v.pitch).toBeGreaterThan(0)
  })

  it('should stop the pitch at straight above or below and wrap the yaw', () => {
    expect(clampView({ yaw: 190, pitch: 120 })).toEqual({ yaw: -170, pitch: 90 })
    expect(clampView({ yaw: -180, pitch: -100 })).toEqual({ yaw: 180, pitch: -90 })
  })

  it('should turn by one step per arrow key, both ways', () => {
    const v = stepView(stepView(SOLID_INITIAL_VIEW, 'ArrowRight'), 'ArrowLeft')
    expect(sameView(v, SOLID_INITIAL_VIEW)).toBe(true)
    expect(stepView(SOLID_INITIAL_VIEW, 'ArrowDown').pitch).toBeGreaterThan(
      SOLID_INITIAL_VIEW.pitch
    )
  })

  it('should slow a flick down until it stops', () => {
    let state: { view: SolidView; velocity: SolidView | null } = {
      view: { yaw: 0, pitch: 0 },
      velocity: { yaw: 0.5, pitch: 0 },
    }
    let frames = 0
    while (state.velocity && frames < 1000) {
      state = coastView(state.view, state.velocity, 16, 300)
      frames++
    }
    expect(state.velocity).toBeNull()
    // It coasts about v·tau = 150° before stopping.
    expect(state.view.yaw).toBeGreaterThan(140)
    expect(state.view.yaw).toBeLessThan(151)
  })

  it('should come back by the shorter way round', () => {
    const half = interpolateView({ yaw: 170, pitch: 0 }, { yaw: -170, pitch: 20 }, 0.5)
    expect(half.yaw).toBe(180)
    expect(half.pitch).toBe(10)
  })
})
