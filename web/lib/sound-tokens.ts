/**
 * Sound tokens of the interactive mode (#251).
 *
 * Every sound is synthesised with the Web Audio API from these values: no audio file, no licence,
 * nothing to download. Tune a sound here, never in a component. What plays when is in
 * docs/design/MOTION.md, "Sound"; each one can be heard on the /design styleguide.
 *
 * There is no failure sound, on purpose (PRINCIPLES.md: no punishment).
 *
 * No framework import: the Expo app will reuse these values.
 */

export type NomSon = 'appui' | 'selection' | 'juste' | 'xp' | 'fin-partiel' | 'fin-complet'

/** One note of a sound. Times in milliseconds from the sound's start. */
export type Note = {
  /** Pitch in Hz. */
  freq: number
  /** When the note starts. */
  at: number
  /** How long it sounds, release included. */
  length: number
  /** Loudness relative to the sound's other notes, 0 to 1. */
  gain: number
  /** Pitch the note glides to over its length, for a pop or a rise. */
  glideTo?: number
}

export type Son = {
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth'
  /** Fade-in of each note, so it never clicks. */
  attack: number
  notes: readonly Note[]
}

/**
 * Overall loudness, 0 to 1, applied to every sound: moderate, under what a video or a game
 * would play at.
 */
export const VOLUME = 0.18

/**
 * Two presses of the same sound closer than this make one sound: a primary button that also
 * changes slide is one press, and a held arrow key does not rattle.
 */
export const ECART_MIN_MS = 90

// Pitches, equal temperament (A4 = 440 Hz).
const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.51
const B5 = 987.77

export const sons: Record<NomSon, Son> = {
  /** An arcade button pressed, a slide change, a step revealed: a short, dry tick. */
  appui: {
    wave: 'triangle',
    attack: 2,
    notes: [{ freq: 440, glideTo: 330, at: 0, length: 45, gain: 0.7 }],
  },
  /** An option picked, a word placed in a blank: a small rising pop. */
  selection: {
    wave: 'sine',
    attack: 4,
    notes: [{ freq: 600, glideTo: 900, at: 0, length: 80, gain: 0.8 }],
  },
  /** A correct answer, with the check mark: two notes rising a sixth. */
  juste: {
    wave: 'triangle',
    attack: 6,
    notes: [
      { freq: G5, at: 0, length: 160, gain: 0.8 },
      { freq: E6, at: 90, length: 260, gain: 0.7 },
    ],
  },
  /** The real XP gain lands on the counter: a bright coin. */
  xp: {
    wave: 'square',
    attack: 3,
    notes: [
      { freq: B5, at: 0, length: 70, gain: 0.35 },
      { freq: E6, at: 70, length: 240, gain: 0.35 },
    ],
  },
  /** The end slide, some exercises solved: a short major arpeggio. */
  'fin-partiel': {
    wave: 'triangle',
    attack: 6,
    notes: [
      { freq: C5, at: 0, length: 180, gain: 0.7 },
      { freq: E5, at: 100, length: 180, gain: 0.7 },
      { freq: G5, at: 200, length: 380, gain: 0.7 },
    ],
  },
  /** The end slide, every exercise solved: the arpeggio climbs to the octave and holds. */
  'fin-complet': {
    wave: 'triangle',
    attack: 6,
    notes: [
      { freq: C5, at: 0, length: 160, gain: 0.7 },
      { freq: E5, at: 90, length: 160, gain: 0.7 },
      { freq: G5, at: 180, length: 160, gain: 0.7 },
      { freq: C6, at: 270, length: 600, gain: 0.8 },
      { freq: E6, at: 270, length: 600, gain: 0.35 },
    ],
  },
}

/** How long a sound lasts, its last note's release included. */
export function dureeSon(nom: NomSon): number {
  return Math.max(...sons[nom].notes.map((n) => n.at + n.length))
}
