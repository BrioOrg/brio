// Evaluator for Scratch programmes parsed by `parseScratch` (ADR 0031, #232).
//
// It walks the statement tree produced by `parseScratch` and computes what the sprite
// *says* (`dire`) and the final value of each variable. `check-content` uses it to verify
// the expected answer of a "prévoir la valeur" exercise, so a wrong computation in the
// content becomes a CI error.
//
// Like the parser, this module imports only types and uses only erasable TypeScript, so it
// runs under Node's type stripping (the same path `check-content` loads).
//
// Scope (v1, develop): the catalogue the parser exposes today — green-flag hat, `demander`,
// `mettre`/`ajouter` on variables, `dire`, `avancer`/`tourner` (motion), the `répéter n fois`
// loop, and operator blocks (+ - * /). Motion blocks run as no-ops: they change no variable
// and say nothing, so a "distance parcourue" question is not evaluated here (it is not what
// the sprite says). Conditions, comparisons, `répéter jusqu'à` and the pen extension are not
// in the parser on `develop` yet (#234/#354); the design below slots them in as new `case`s
// of two exhaustive switches, with no rewrite — see the note above each switch.

import type { ScratchStatement, ScratchValue } from './scratch'

/** A Scratch value at runtime: a number, or a string (text « », `réponse`, a `demander` input). */
export type ScratchRuntimeValue = number | string

export type ScratchEvalErrorCode =
  /** A `demander` ran but no input was left to feed it (give more `inputs`). */
  | 'missingInput'
  /** The execution budget was exceeded — a runaway loop (`maxSteps`). */
  | 'tooManySteps'
  /** A `répéter` count is negative, fractional or not a finite number. */
  | 'invalidRepeatCount'

export type ScratchEvalError = {
  code: ScratchEvalErrorCode
  /** 1-based line of the offending statement, as counted by the parser. */
  line: number
  message: string
}

export type ScratchEvalResult =
  | {
      ok: true
      /** What the sprite said, in order — the output of every `dire`. */
      says: ScratchRuntimeValue[]
      /** The final value of every variable that was set (unset variables default to 0). */
      variables: Record<string, ScratchRuntimeValue>
    }
  | { ok: false; error: ScratchEvalError }

export type ScratchEvalOptions = {
  /**
   * Values fed to successive `demander … et attendre` blocks, in order: the first `demander`
   * stores `inputs[0]` in `réponse`, the second `inputs[1]`, and so on. A number or a string;
   * a string is coerced to a number by arithmetic exactly as Scratch does (see `toNumber`).
   */
  inputs?: ScratchRuntimeValue[]
  /**
   * Upper bound on executed statements, a guard against a runaway loop (a huge `répéter n fois`,
   * and the future `répéter jusqu'à`). Default 100000 — far above any teaching programme.
   */
  maxSteps?: number
}

const DEFAULT_MAX_STEPS = 100_000

const MESSAGES: Record<ScratchEvalErrorCode, string> = {
  missingInput: 'a « demander » ran but no input was provided for it',
  tooManySteps: 'the programme ran too long (a loop that never ends?)',
  invalidRepeatCount: 'the number of repetitions must be a whole number ≥ 0',
}

// Mutable state threaded through execution. A class without parameter properties keeps the
// module erasable (type stripping forbids `constructor(private …)`).
class EvalState {
  variables: Record<string, ScratchRuntimeValue> = {}
  says: ScratchRuntimeValue[] = []
  /** The value stored by the last `demander`; read by the `réponse` reporter. */
  answer: ScratchRuntimeValue = ''
  inputs: ScratchRuntimeValue[]
  nextInput = 0
  steps = 0
  maxSteps: number

  constructor(inputs: ScratchRuntimeValue[], maxSteps: number) {
    this.inputs = inputs
    this.maxSteps = maxSteps
  }
}

/** Thrown internally to unwind to `evaluateScratch`; never escapes the module. */
class ScratchEvalAbort extends Error {
  code: ScratchEvalErrorCode
  line: number
  constructor(code: ScratchEvalErrorCode, line: number) {
    super(MESSAGES[code])
    this.code = code
    this.line = line
  }
}

/**
 * Run a parsed Scratch programme and return what it says and its final variables, or the first
 * runtime error. Pure: it never touches the DOM, the filesystem or the clock.
 */
export function evaluateScratch(
  script: ScratchStatement[],
  options: ScratchEvalOptions = {}
): ScratchEvalResult {
  const state = new EvalState(options.inputs ?? [], options.maxSteps ?? DEFAULT_MAX_STEPS)
  try {
    runBlock(script, state)
  } catch (e) {
    if (e instanceof ScratchEvalAbort) {
      return { ok: false, error: { code: e.code, line: e.line, message: e.message } }
    }
    throw e
  }
  return { ok: true, says: state.says, variables: state.variables }
}

function runBlock(block: ScratchStatement[], state: EvalState): void {
  for (const statement of block) exec(statement, state)
}

// Execution of one statement. The switch is exhaustive over today's `ScratchStatement` union,
// so when the parser gains `if` / `ifElse` / `repeatUntil` / pen blocks (#234/#354) TypeScript
// flags this switch until each new kind gets a `case` here — the evaluator grows by addition,
// not by rewrite.
function exec(statement: ScratchStatement, state: EvalState): void {
  if (++state.steps > state.maxSteps) {
    throw new ScratchEvalAbort('tooManySteps', statement.line)
  }
  switch (statement.kind) {
    case 'whenFlagClicked':
      return
    case 'ask': {
      // The question itself is not shown; the answer comes from the provided inputs.
      if (state.nextInput >= state.inputs.length) {
        throw new ScratchEvalAbort('missingInput', statement.line)
      }
      state.answer = state.inputs[state.nextInput++]
      return
    }
    case 'setVariable':
      state.variables[statement.variable] = evalValue(statement.value, state)
      return
    case 'changeVariable': {
      const current = toNumber(readVariable(statement.variable, state))
      state.variables[statement.variable] = current + toNumber(evalValue(statement.by, state))
      return
    }
    case 'say':
      state.says.push(evalValue(statement.message, state))
      return
    case 'move':
    case 'turn':
      // Motion is out of scope in v1: it says nothing and changes no variable. Evaluate its
      // operand anyway so a malformed value would still surface, then ignore the effect.
      evalValue(statement.kind === 'move' ? statement.steps : statement.degrees, state)
      return
    case 'repeat': {
      const raw = toNumber(evalValue(statement.times, state))
      if (!Number.isInteger(raw) || raw < 0) {
        throw new ScratchEvalAbort('invalidRepeatCount', statement.line)
      }
      for (let i = 0; i < raw; i++) runBlock(statement.body, state)
      return
    }
  }
}

function readVariable(name: string, state: EvalState): ScratchRuntimeValue {
  // Scratch treats a never-set variable as 0.
  return name in state.variables ? state.variables[name] : 0
}

// Evaluation of a value (reporter) block. Exhaustive over today's `ScratchValue` union; the
// future comparison/boolean operator blocks (hexagons: = < > et ou) arrive as new kinds and
// get their own `case` here without disturbing the rest.
function evalValue(value: ScratchValue, state: EvalState): ScratchRuntimeValue {
  switch (value.kind) {
    case 'number':
      return value.value
    case 'text':
      return value.text
    case 'variable':
      return readVariable(value.name, state)
    case 'answer':
      return state.answer
    case 'operator': {
      const left = toNumber(evalValue(value.left, state))
      const right = toNumber(evalValue(value.right, state))
      switch (value.op) {
        case '+':
          return left + right
        case '-':
          return left - right
        case '*':
          return left * right
        case '/':
          // Scratch divides as real numbers; division by zero yields Infinity, as in Scratch.
          return left / right
      }
    }
  }
}

/**
 * Coerce a runtime value to a number the way Scratch's arithmetic blocks do: a number stays
 * itself; a string is read as a number (a decimal comma is accepted, matching how the parser
 * reads number literals), and anything non-numeric — including empty text — counts as 0.
 */
export function toNumber(value: ScratchRuntimeValue): number {
  if (typeof value === 'number') return value
  const trimmed = value.trim()
  if (trimmed === '') return 0
  const n = Number(trimmed.replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}
