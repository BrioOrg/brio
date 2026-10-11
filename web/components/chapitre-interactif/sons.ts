'use client'

import { useSyncExternalStore } from 'react'
import { ECART_MIN_MS, VOLUME, sons, type NomSon } from '@/lib/sound-tokens'

/**
 * The interactive mode's sounds (#251): off by default, remembered on the device, synthesised
 * from the sound tokens with the Web Audio API.
 *
 * - Nothing exists while sound is off: no `AudioContext` is ever created.
 * - Nothing plays before the student's first gesture on the page (the browsers' autoplay policy),
 *   and the context is created in a gesture's wake, never at load.
 * - A hidden tab is silent: the notes playing stop, the context is suspended, and nothing missed
 *   is played on return.
 * - Reduced motion does not mute sound: it is its own preference.
 */

const CLE = 'brio_sons'

const abonnes = new Set<() => void>()
let contexte: AudioContext | null = null
let sortie: GainNode | null = null
const enCours = new Set<OscillatorNode>()
const dernierJoue: Partial<Record<NomSon, number>> = {}

/** The stored preference. Storage may be missing or refused (a private window): off then. */
export function sonsActifs(): boolean {
  try {
    return window.localStorage.getItem(CLE) === '1'
  } catch {
    return false
  }
}

function abonner(onChange: () => void) {
  abonnes.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    abonnes.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Turns sound on or off. Turning it on is a gesture: the confirmation tick plays at once. */
export function basculerSons(): void {
  const actif = !sonsActifs()
  try {
    if (actif) window.localStorage.setItem(CLE, '1')
    else window.localStorage.removeItem(CLE)
  } catch {
    // Not remembered, then: the switch still reads the storage, so it stays off.
  }
  for (const abonne of Array.from(abonnes)) abonne()
  if (actif) jouer('appui')
  else couper()
}

/** Off on the server and at hydration, so the first paint never differs. */
export function useSons(): boolean {
  return useSyncExternalStore(abonner, sonsActifs, () => false)
}

/** Whether the student has interacted with the page yet. Older browsers lack the API: allowed. */
function gesteFait(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation
  return activation === undefined || activation.hasBeenActive
}

function surVisibilite() {
  if (!contexte) return
  if (document.hidden) {
    couper()
    void contexte.suspend().catch(() => {})
  } else {
    void contexte.resume().catch(() => {})
  }
}

/** The page's one context, created on first use. Null where Web Audio is missing. */
function ouvrirContexte(): AudioContext | null {
  if (contexte) return contexte
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  contexte = new Ctor()
  sortie = contexte.createGain()
  sortie.gain.value = VOLUME
  sortie.connect(contexte.destination)
  document.addEventListener('visibilitychange', surVisibilite)
  return contexte
}

/** Stops every note still playing. */
function couper() {
  for (const osc of Array.from(enCours)) {
    try {
      osc.stop()
    } catch {
      // Already stopped.
    }
  }
  enCours.clear()
}

/**
 * Plays a sound, when sound is on, the tab visible and the student has already interacted. The
 * same sound twice within `ECART_MIN_MS` plays once. `force`: the /design styleguide, which plays
 * a sound whatever the stored preference.
 */
export function jouer(nom: NomSon, force = false): void {
  if (typeof window === 'undefined') return
  if (!force && !sonsActifs()) return
  if (document.hidden || !gesteFait()) return
  const maintenant = performance.now()
  const precedent = dernierJoue[nom]
  if (precedent !== undefined && maintenant - precedent < ECART_MIN_MS) return
  dernierJoue[nom] = maintenant

  const ctx = ouvrirContexte()
  if (!ctx || !sortie) return
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})

  const son = sons[nom]
  const t0 = ctx.currentTime
  for (const note of son.notes) {
    const debut = t0 + note.at / 1000
    const fin = debut + note.length / 1000
    const osc = ctx.createOscillator()
    osc.type = son.wave
    osc.frequency.setValueAtTime(note.freq, debut)
    if (note.glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(note.glideTo, fin)

    // A short fade-in, then an exponential fall to silence: no click at either end.
    const enveloppe = ctx.createGain()
    enveloppe.gain.setValueAtTime(0.0001, debut)
    enveloppe.gain.exponentialRampToValueAtTime(note.gain, debut + son.attack / 1000)
    enveloppe.gain.exponentialRampToValueAtTime(0.0001, fin)

    osc.connect(enveloppe)
    enveloppe.connect(sortie)
    osc.start(debut)
    osc.stop(fin)
    enCours.add(osc)
    osc.onended = () => {
      enCours.delete(osc)
      enveloppe.disconnect()
    }
  }
}

/** Tests only: forget the context, as a new page would. */
export function reinitialiserSons(): void {
  couper()
  if (contexte) document.removeEventListener('visibilitychange', surVisibilite)
  contexte = null
  sortie = null
  for (const nom of Object.keys(dernierJoue) as NomSon[]) delete dernierJoue[nom]
}
