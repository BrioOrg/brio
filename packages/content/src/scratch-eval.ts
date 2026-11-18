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
// Scope: the whole catalogue of ADR 0031 — green-flag hat, `demander`, `mettre`/`ajouter` on
// variables, `dire`, `avancer`/`tourner` (motion), `répéter n fois`, operator blocks (+ - * /),
// and the 4e blocks (#234): `si … alors [… sinon]`, `répéter jusqu'à ce que`, the boolean
// blocks (< = >, et, ou, non) and the pen. Motion and pen blocks run as no-ops: they change no
// variable and say nothing, so a "distance parcourue" or "figure tracée" question is not
// evaluated here (it is not what the sprite says). Both switches below are exhaustive and
// checked by TypeScript (`never`), so a block added to the parser cannot be silently skipped.

import type { ScratchBoolean, ScratchStatement, ScratchValue } from './scratch'

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
      /** How many `inputs` the `demander` blocks consumed (fewer than given = a wrong link). */
      inputsUsed: number
    }
  | { ok: false; error: ScratchEvalError }

export type ScratchEvalOptions = {
  /**
   * Values fed to successive `demander … et attendre` blocks, in order: the first `demander`
   * stores `inputs[0]` in `réponse`, the second `inputs[1]`, and so on. A number or a string;
   * a string is coerced to a number by arithmetic as Scratch does (see `toNumber`), except that
   * Brio also reads a decimal comma — check-content refuses one in a checked programme.
   */
  inputs?: ScratchRuntimeValue[]
  /**
   * Upper bound on executed statements and loop turns, a guard against a runaway loop (a huge
   * `répéter n fois`, a `répéter jusqu'à ce que` whose condition never comes true). Default
   * 100000 — far above any teaching programme.
   */
  maxSteps?: number
}

const DEFAULT_MAX_STEPS = 100_000

const MESSAGES: Record<ScratchEvalErrorCode, string> = {
  missingInput: 'a « demander » ran but no input was provided for it',
  tooManySteps: 'the programme ran too long (a loop that never ends?)',
  invalidRepeatCount:
    'the number of repetitions must be a whole number ≥ 0 (Scratch would round it or skip the loop; write it whole)',
}

// Mutable state threaded through execution. A class without parameter properties keeps the
// module erasable (type stripping forbids `constructor(private …)`).
class EvalState {
  // No prototype: a variable named `constructor` or `__proto__` is an ordinary variable.
  variables: Record<string, ScratchRuntimeValue> = Object.create(null)
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
  options: ScratchEvalOptions | null = {}
): ScratchEvalResult {
  // Defensive about callers outside TypeScript (check-content is plain JS): an input is a number
  // or a text, as typed in Scratch; a budget that is not a finite number ≥ 0 would never stop.
  const rawInputs: unknown = options?.inputs
  const inputs = Array.isArray(rawInputs)
    ? rawInputs.map((v: unknown) => (typeof v === 'number' ? v : String(v ?? '')))
    : []
  const rawMax = options?.maxSteps
  const maxSteps =
    typeof rawMax === 'number' && Number.isFinite(rawMax) && rawMax >= 0
      ? rawMax
      : DEFAULT_MAX_STEPS
  const state = new EvalState(inputs, maxSteps)
  try {
    runBlock(script, state)
  } catch (e) {
    if (e instanceof ScratchEvalAbort) {
      return { ok: false, error: { code: e.code, line: e.line, message: e.message } }
    }
    throw e
  }
  return {
    ok: true,
    says: state.says,
    variables: { ...state.variables },
    inputsUsed: state.nextInput,
  }
}

function runBlock(block: ScratchStatement[], state: EvalState): void {
  for (const statement of block) exec(statement, state)
}

function step(state: EvalState, line: number): void {
  if (++state.steps > state.maxSteps) throw new ScratchEvalAbort('tooManySteps', line)
}

// Execution of one statement. The switch is exhaustive over `ScratchStatement`: the `never` in
// `default` makes TypeScript flag a block kind the parser gains until it gets its `case` here.
function exec(statement: ScratchStatement, state: EvalState): void {
  step(state, statement.line)
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
    case 'penDown':
    case 'penUp':
    case 'clear':
      // The pen draws; it says nothing and changes no variable.
      return
    case 'repeat': {
      const raw = toNumber(evalValue(statement.times, state))
      if (!Number.isInteger(raw) || raw < 0) {
        throw new ScratchEvalAbort('invalidRepeatCount', statement.line)
      }
      for (let i = 0; i < raw; i++) runBlock(statement.body, state)
      return
    }
    case 'if':
      if (evalBoolean(statement.condition, state)) runBlock(statement.body, state)
      else if (statement.elseBody !== null) runBlock(statement.elseBody, state)
      return
    case 'repeatUntil':
      // As in Scratch, the condition is tested BEFORE each turn: already true, the body never runs.
      // Each turn counts as a step, so a condition that never comes true ends in `tooManySteps`.
      while (!evalBoolean(statement.condition, state)) {
        runBlock(statement.body, state)
        step(state, statement.line)
      }
      return
    default: {
      const unhandled: never = statement
      throw new Error(`unhandled Scratch statement ${JSON.stringify(unhandled)}`)
    }
  }
}

// Evaluation of a boolean (hexagonal) block; exhaustive over `ScratchBoolean`.
function evalBoolean(condition: ScratchBoolean, state: EvalState): boolean {
  switch (condition.kind) {
    case 'comparison': {
      const order = compare(evalValue(condition.left, state), evalValue(condition.right, state))
      switch (condition.op) {
        case '<':
          return order < 0
        case '=':
          return order === 0
        case '>':
          return order > 0
      }
    }
    // Neither side has effects, so evaluating both (no short-circuit) changes nothing.
    case 'logical': {
      const left = evalBoolean(condition.left, state)
      const right = evalBoolean(condition.right, state)
      return condition.op === 'et' ? left && right : left || right
    }
    case 'not':
      return !evalBoolean(condition.operand, state)
    default: {
      const unhandled: never = condition
      throw new Error(`unhandled Scratch boolean ${JSON.stringify(unhandled)}`)
    }
  }
}

/**
 * Compare two values the way Scratch's `<`, `=` and `>` do (scratch-vm `Cast.compare`): as
 * numbers when both read as numbers, otherwise as texts, **ignoring case** (« Oui » = « oui »).
 * Empty or blank text is not a number. One Brio convention differs from Scratch: a decimal comma
 * reads as a number here, as everywhere in Brio (ADR 0031 §1), whereas Scratch compares « 2,5 »
 * as text — hence AUTHORING's rule to compare integers only.
 */
export function compare(a: ScratchRuntimeValue, b: ScratchRuntimeValue): number {
  const n1 = strictNumber(a)
  const n2 = strictNumber(b)
  if (n1 === null || n2 === null) {
    const s1 = String(a).toLowerCase()
    const s2 = String(b).toLowerCase()
    return s1 < s2 ? -1 : s1 > s2 ? 1 : 0
  }
  if (n1 === n2) return 0 // also Infinity = Infinity, where n1 - n2 would be NaN
  return n1 - n2
}

/** The number a value reads as, or null when it is not numeric (blank text included). */
export function strictNumber(value: ScratchRuntimeValue): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value
  const trimmed = String(value).trim()
  if (trimmed === '') return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

function readVariable(name: string, state: EvalState): ScratchRuntimeValue {
  // Scratch treats a never-set variable as 0.
  return Object.hasOwn(state.variables, name) ? state.variables[name] : 0
}

// Evaluation of a value (reporter) block; exhaustive over `ScratchValue` (TypeScript checks the
// return on every path). Booleans are a separate union (`evalBoolean`): the parser never puts one
// in a value slot (ADR 0031 §2).
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
  // NaN (0 / 0) counts as 0, as in Scratch's Cast.toNumber: ((0 / 0) + 1) is 1, not NaN.
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value
  const trimmed = String(value).trim()
  if (trimmed === '') return 0
  const n = Number(trimmed.replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
}
