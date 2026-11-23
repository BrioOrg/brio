'use client'

import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  deplacer,
  depuisSvg,
  fenetreParDefaut,
  modeleVue,
  orthonormer,
  zoomAuCentre,
  zoomAutour,
  type CourbeVue,
  type Fenetre,
  type ModeAngle,
  type TailleVue,
  type TexteVue,
} from '@brio/content'

import { CURVE_DASH } from '@/components/function-plot-layer'
import { HALO_CLASS } from '@/components/figure/halo'
import { Icon } from '@/components/ui/icon'
import { Infobulle } from '@/components/ui/infobulle'
import { CURVE_FILL, CURVE_STROKE } from '@/lib/curve-colours'

import { BARRE, BOUTON_ICONE, BOUTON_SEGMENT } from './classes'

// The grid of the calculator (spec U4 §5): an SVG the size of its box, measured with a
// ResizeObserver. Dragging moves the plane, the wheel and a pinch zoom about the pointer; buttons
// zoom about the centre and bring the default view back. The drawing model — grid, axes, numbers,
// curves — comes whole from @brio/content (`modeleVue`): here, only its mapping to SVG.

/** One wheel notch (100 px of deltaY) zooms by about 1,2. */
const ZOOM_MOLETTE = 0.0018
/** The + and − buttons. */
const ZOOM_BOUTON = 1.5

type Point = { x: number; y: number }

type Props = {
  /** The window set by the student; null for the default view of the drawing's size. */
  fenetre: Fenetre | null
  orthonorme: boolean
  angle: ModeAngle
  courbes: readonly CourbeVue[]
  /** What the drawing shows, for screen readers (U5: "2 courbes : …"). */
  description: (fenetre: Fenetre) => string
  onFenetre: (f: Fenetre) => void
  onOrthonorme: (o: boolean) => void
  onAngle: (a: ModeAngle) => void
  onVueParDefaut: () => void
}

/** The window drawn: the student's, or the default one, made orthonormal when asked. */
export function fenetreEffective(
  fenetre: Fenetre | null,
  orthonorme: boolean,
  taille: TailleVue
): Fenetre {
  const f = fenetre ?? fenetreParDefaut(taille)
  return orthonorme ? orthonormer(f, taille) : f
}

function Nombre({ t, className = '' }: { t: TexteVue; className?: string }) {
  return (
    <text
      x={t.x}
      y={t.y}
      textAnchor={t.ancre}
      dominantBaseline={t.ligne}
      className={`fill-current font-prose text-xs tabular-nums ${HALO_CLASS} ${className}`}
    >
      {t.texte}
    </text>
  )
}

export function RepereInteractif({
  fenetre,
  orthonorme,
  angle,
  courbes,
  description,
  onFenetre,
  onOrthonorme,
  onAngle,
  onVueParDefaut,
}: Props) {
  const boiteRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const titreId = useId()
  const descId = useId()
  const [taille, setTaille] = useState<TailleVue | null>(null)

  // Measured, never guessed: the CSS gives the box its height, so nothing moves when it is known.
  useLayoutEffect(() => {
    const boite = boiteRef.current
    if (!boite) return
    const mesurer = (largeur: number, hauteur: number) => {
      const l = Math.round(largeur)
      const h = Math.round(hauteur)
      setTaille((t) => (t && t.largeur === l && t.hauteur === h ? t : { largeur: l, hauteur: h }))
    }
    const r = boite.getBoundingClientRect()
    mesurer(r.width, r.height)
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([e]) => mesurer(e.contentRect.width, e.contentRect.height))
    obs.observe(boite)
    return () => obs.disconnect()
  }, [])

  const tailleSure = taille && taille.largeur > 0 && taille.hauteur > 0 ? taille : null
  const effective = useMemo(
    () => (tailleSure ? fenetreEffective(fenetre, orthonorme, tailleSure) : null),
    [fenetre, orthonorme, tailleSure]
  )

  // Pointer moves can come faster than renders: each one starts from the latest window.
  const fenetreRef = useRef<Fenetre | null>(effective)
  const tailleRef = useRef<TailleVue | null>(tailleSure)
  useLayoutEffect(() => {
    fenetreRef.current = effective
    tailleRef.current = tailleSure
  }, [effective, tailleSure])

  const changer = (f: Fenetre) => {
    fenetreRef.current = f
    onFenetre(f)
  }
  const changerRef = useRef(changer)
  useLayoutEffect(() => {
    changerRef.current = changer
  })

  // The drawing follows the typing and the drag, but never holds them up.
  const vue = useDeferredValue(
    useMemo(() => ({ effective, tailleSure, courbes }), [effective, tailleSure, courbes])
  )
  const modele = useMemo(
    () =>
      vue.effective && vue.tailleSure
        ? modeleVue(vue.effective, vue.tailleSure, vue.courbes)
        : null,
    [vue]
  )

  // --- Pan and pinch ------------------------------------------------------------------------------
  const pointeurs = useRef(new Map<number, Point>())

  const position = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current?.getBoundingClientRect()
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }
  }

  function surPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointeurs.current.set(e.pointerId, position(e))
  }

  function surPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const avant = pointeurs.current.get(e.pointerId)
    const f = fenetreRef.current
    const t = tailleRef.current
    if (!avant || !f || !t) return
    const apres = position(e)
    if (pointeurs.current.size === 1) {
      pointeurs.current.set(e.pointerId, apres)
      changer(deplacer(f, apres.x - avant.x, apres.y - avant.y, t))
      return
    }
    // Two fingers: zoom by the change of their distance about their middle, and follow it.
    const autre = [...pointeurs.current.entries()].find(([id]) => id !== e.pointerId)?.[1]
    pointeurs.current.set(e.pointerId, apres)
    if (!autre) return
    const d0 = Math.hypot(avant.x - autre.x, avant.y - autre.y)
    const d1 = Math.hypot(apres.x - autre.x, apres.y - autre.y)
    const m0 = { x: (avant.x + autre.x) / 2, y: (avant.y + autre.y) / 2 }
    const m1 = { x: (apres.x + autre.x) / 2, y: (apres.y + autre.y) / 2 }
    let g = d0 > 0 && d1 > 0 ? zoomAutour(f, depuisSvg(f, t)(m0.x, m0.y), d1 / d0) : f
    g = deplacer(g, m1.x - m0.x, m1.y - m0.y, t)
    changer(g)
  }

  function surPointerFin(e: React.PointerEvent<SVGSVGElement>) {
    pointeurs.current.delete(e.pointerId)
  }

  // The wheel: a native listener, the only way to keep the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    function surMolette(e: WheelEvent) {
      const f = fenetreRef.current
      const t = tailleRef.current
      if (!f || !t) return
      e.preventDefault()
      const unite = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? t.hauteur : 1
      const facteur = Math.exp(-e.deltaY * unite * ZOOM_MOLETTE)
      const r = svg!.getBoundingClientRect()
      const point = depuisSvg(f, t)(e.clientX - r.left, e.clientY - r.top)
      changerRef.current(zoomAutour(f, point, facteur))
    }
    svg.addEventListener('wheel', surMolette, { passive: false })
    return () => svg.removeEventListener('wheel', surMolette)
  }, [])

  const zoomer = (facteur: number) => {
    const f = fenetreRef.current
    if (f) changer(zoomAuCentre(f, facteur))
  }

  const largeur = modele?.largeur ?? 0
  const hauteur = modele?.hauteur ?? 0

  return (
    <div ref={boiteRef} className="absolute inset-0 overflow-hidden bg-surface-page">
      <svg
        ref={svgRef}
        role="img"
        aria-labelledby={`${titreId} ${descId}`}
        viewBox={largeur > 0 ? `0 0 ${largeur} ${hauteur}` : undefined}
        onPointerDown={surPointerDown}
        onPointerMove={surPointerMove}
        onPointerUp={surPointerFin}
        onPointerCancel={surPointerFin}
        className="absolute inset-0 size-full cursor-grab touch-none select-none text-ink active:cursor-grabbing"
      >
        <title id={titreId}>Repère</title>
        <desc id={descId}>{effective ? description(effective) : ''}</desc>
        {modele && (
          <>
            <g className="stroke-line" strokeWidth={1}>
              {modele.grille.verticales.map((x) => (
                <line key={`v${x}`} x1={x} y1={0} x2={x} y2={hauteur} />
              ))}
              {modele.grille.horizontales.map((y) => (
                <line key={`h${y}`} x1={0} y1={y} x2={largeur} y2={y} />
              ))}
            </g>
            <g>
              {[modele.axeX, modele.axeY].map((axe, i) =>
                axe.ligne ? (
                  <g key={i}>
                    <line {...axe.ligne} stroke="currentColor" strokeWidth={1.5} />
                    {axe.fleche && <polygon points={axe.fleche} fill="currentColor" />}
                  </g>
                ) : null
              )}
            </g>
            <g>
              {modele.courbes.map((c) => (
                <g key={c.id} data-courbe={c.id}>
                  {c.d && (
                    <path
                      d={c.d}
                      fill="none"
                      className={CURVE_STROKE[c.couleur]}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={c.pointille ? CURVE_DASH : undefined}
                    />
                  )}
                  {c.points.map((p, j) => (
                    <circle key={j} cx={p.x} cy={p.y} r={3} className={CURVE_FILL[c.couleur]} />
                  ))}
                </g>
              ))}
            </g>
            <g>
              {[...modele.axeX.nombres, ...modele.axeY.nombres].map((t) => (
                <Nombre key={`${t.texte}-${t.x}-${t.y}`} t={t} />
              ))}
              {modele.origine && <Nombre t={modele.origine} />}
              {[modele.axeX.nom, modele.axeY.nom].map((t) =>
                t ? <Nombre key={t.texte} t={t} className="text-sm italic" /> : null
              )}
            </g>
          </>
        )}
      </svg>

      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <div role="group" aria-label="Unité des angles" className={BARRE}>
          <button
            type="button"
            aria-pressed={angle === 'radians'}
            aria-label="Radians"
            onClick={() => onAngle('radians')}
            className={BOUTON_SEGMENT}
          >
            Rad
          </button>
          <button
            type="button"
            aria-pressed={angle === 'degres'}
            aria-label="Degrés"
            onClick={() => onAngle('degres')}
            className={BOUTON_SEGMENT}
          >
            Deg
          </button>
        </div>
        <div className={BARRE}>
          <button
            type="button"
            aria-pressed={orthonorme}
            aria-label="Repère orthonormé : mêmes unités sur les deux axes"
            onClick={() => onOrthonorme(!orthonorme)}
            className={BOUTON_SEGMENT}
          >
            Orthonormé
          </button>
        </div>
      </div>

      <div
        role="group"
        aria-label="Outils du repère"
        className={`absolute bottom-3 right-3 z-10 ${BARRE}`}
      >
        <Infobulle label="Dézoomer">
          <button
            type="button"
            aria-label="Dézoomer"
            onClick={() => zoomer(1 / ZOOM_BOUTON)}
            className={BOUTON_ICONE}
          >
            <Icon name="minus" size={20} />
          </button>
        </Infobulle>
        <Infobulle label="Zoomer">
          <button
            type="button"
            aria-label="Zoomer"
            onClick={() => zoomer(ZOOM_BOUTON)}
            className={BOUTON_ICONE}
          >
            <Icon name="plus" size={20} />
          </button>
        </Infobulle>
        <Infobulle label="Vue par défaut">
          <button
            type="button"
            aria-label="Revenir à la vue par défaut"
            onClick={onVueParDefaut}
            className={BOUTON_ICONE}
          >
            <Icon name="house-simple" size={20} />
          </button>
        </Infobulle>
      </div>
    </div>
  )
}
