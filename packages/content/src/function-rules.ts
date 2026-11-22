// The rules a figure's functions, readings and parameters must follow (ADR 0038 §7), shared by
// check-content and the teacher editor. Each issue carries its path in the spec and a French
// message written for the author: both callers print it as is.

import { parseExpression } from './expression'
import {
  bindFunction,
  compileFunctions,
  formatReadingValue,
  parameterScope,
  solveFor,
  type FunctionPlotSpec,
} from './function-plot'

export type FunctionIssue = { path: string; message: string }

export const MAX_FUNCTIONS = 4
export const MAX_READINGS = 6
export const MAX_PARAMETERS = 3
/** A slider of more notches than this cannot be moved one notch at a time with any precision. */
export const MAX_PARAMETER_NOTCHES = 400

const FUNCTION_NAME = /^[a-zA-Z][0-9]?$/
const PARAMETER_NAME = /^[a-zA-Z]$/

function isMultiple(value: number, of: number): boolean {
  const q = value / of
  return Math.abs(q - Math.round(q)) < 1e-9
}

function n(v: number): string {
  return formatReadingValue(v)
}

export function checkFunctionPlot(spec: FunctionPlotSpec): FunctionIssue[] {
  const issues: FunctionIssue[] = []
  const functions = spec.functions ?? []
  const readings = spec.readings ?? []
  const parameters = spec.parameters ?? []
  if (functions.length === 0 && readings.length === 0 && parameters.length === 0) return issues

  if (!spec.axes) {
    issues.push({
      path: 'functions',
      message: 'Une fonction se trace dans un repère : coche « Tracer un repère ».',
    })
    return issues
  }
  const { x: xAxis, y: yAxis } = spec.axes
  if (functions.length > MAX_FUNCTIONS) {
    issues.push({
      path: 'functions',
      message: `Au plus ${MAX_FUNCTIONS} courbes dans une figure : retire-en ${functions.length - MAX_FUNCTIONS}.`,
    })
  }
  if (readings.length > MAX_READINGS) {
    issues.push({ path: 'readings', message: `Au plus ${MAX_READINGS} lectures dans une figure.` })
  }
  if (parameters.length > MAX_PARAMETERS) {
    issues.push({
      path: 'parameters',
      message: `Au plus ${MAX_PARAMETERS} curseurs dans une figure.`,
    })
  }

  // Parameters
  const parameterNames = new Set<string>()
  parameters.forEach((p, i) => {
    const path = `parameters[${i}]`
    if (!PARAMETER_NAME.test(p.name ?? '')) {
      issues.push({
        path: `${path}.name`,
        message: 'Un paramètre se nomme par une seule lettre (a, b, k…).',
      })
    } else if (p.name === 'x') {
      issues.push({
        path: `${path}.name`,
        message: 'x est la variable : choisis une autre lettre pour le paramètre.',
      })
    } else if (parameterNames.has(p.name)) {
      issues.push({ path: `${path}.name`, message: `Deux paramètres s’appellent ${p.name}.` })
    }
    parameterNames.add(p.name)
    if (!(p.min < p.max)) {
      issues.push({
        path: `${path}.max`,
        message: `Le maximum de ${p.name} doit dépasser son minimum.`,
      })
      return
    }
    if (!(p.step > 0)) {
      issues.push({
        path: `${path}.step`,
        message: `Le pas de ${p.name} doit être plus grand que 0.`,
      })
      return
    }
    if ((p.max - p.min) / p.step > MAX_PARAMETER_NOTCHES) {
      issues.push({
        path: `${path}.step`,
        message: `Ce pas donne plus de ${MAX_PARAMETER_NOTCHES} crans au curseur de ${p.name} : choisis un pas plus grand.`,
      })
    }
    if (!isMultiple(p.max - p.min, p.step)) {
      issues.push({
        path: `${path}.step`,
        message: `De ${n(p.min)} à ${n(p.max)}, le curseur de ${p.name} doit avancer d’un nombre entier de pas de ${n(p.step)}.`,
      })
    }
    if (p.value < p.min || p.value > p.max || !isMultiple(p.value - p.min, p.step)) {
      issues.push({
        path: `${path}.value`,
        message: `${p.name} = ${n(p.value)} n’est pas un cran du curseur (de ${n(p.min)} à ${n(p.max)}, pas de ${n(p.step)}).`,
      })
    }
  })

  // Functions
  const variables = ['x', ...parameterNames]
  const functionNames = new Set<string>()
  const used = new Set<string>()
  const readable = new Set<string>()
  functions.forEach((fn, i) => {
    const path = `functions[${i}]`
    if (!FUNCTION_NAME.test(fn.name ?? '')) {
      issues.push({
        path: `${path}.name`,
        message: 'Une fonction se nomme par une lettre (f, g, h…).',
      })
    } else if (functionNames.has(fn.name)) {
      issues.push({ path: `${path}.name`, message: `Deux fonctions s’appellent ${fn.name}.` })
    } else if (parameterNames.has(fn.name) || fn.name === 'x') {
      issues.push({
        path: `${path}.name`,
        message: `${fn.name} est déjà une lettre de l’expression : nomme la fonction autrement.`,
      })
    }
    functionNames.add(fn.name)
    const parsed = parseExpression(fn.expr ?? '', { variables })
    if (!parsed.ok) {
      issues.push({ path: `${path}.expr`, message: parsed.error.message })
      return
    }
    parsed.expression.variables.forEach((v) => used.add(v))
    if (fn.domain) {
      const [a, b] = fn.domain
      if (!(a < b)) {
        issues.push({
          path: `${path}.domain`,
          message: 'Le début du domaine doit être inférieur à sa fin.',
        })
        return
      }
      if (a < xAxis.from - 1e-9 || b > xAxis.to + 1e-9) {
        issues.push({
          path: `${path}.domain`,
          message: `Le domaine [${n(a)} ; ${n(b)}] doit tenir dans l’axe des abscisses, de ${n(xAxis.from)} à ${n(xAxis.to)}.`,
        })
        return
      }
    }
    readable.add(fn.name)
  })
  parameterNames.forEach((name) => {
    if (!used.has(name)) {
      const i = parameters.findIndex((p) => p.name === name)
      issues.push({
        path: `parameters[${i}].name`,
        message: `Le paramètre ${name} n’apparaît dans aucune expression : son curseur ne changerait rien.`,
      })
    }
  })

  // What the student sees by default: each curve visible, each reading reachable.
  if (readable.size === 0) return issues
  const drawable = { ...spec, functions: functions.filter((f) => readable.has(f.name)) }
  const compiled = compileFunctions(drawable)
  const scope = parameterScope(spec)
  const inY = (y: number) => y >= yAxis.from - 1e-9 && y <= yAxis.to + 1e-9
  functions.forEach((fn, i) => {
    const c = compiled.get(fn.name)
    if (!c || !readable.has(fn.name)) return
    const f = bindFunction(c, scope)
    let visible = false
    for (let k = 0; k <= 400 && !visible; k++) {
      const y = f(c.from + ((c.to - c.from) * k) / 400)
      visible = Number.isFinite(y) && inY(y)
    }
    if (!visible) {
      issues.push({
        path: `functions[${i}].expr`,
        message: `La courbe de ${fn.name} ne passe pas dans le repère : élargis l’axe des ordonnées ou change le domaine.`,
      })
    }
  })

  readings.forEach((r, i) => {
    const path = `readings[${i}]`
    const c = compiled.get(r.function)
    if (!functionNames.has(r.function)) {
      issues.push({
        path: `${path}.function`,
        message: `Aucune fonction ne s’appelle ${r.function || '(vide)'}.`,
      })
      return
    }
    if (!c) return
    const f = bindFunction(c, scope)
    const name = r.function
    if (r.x !== undefined) {
      if (r.x < c.from - 1e-9 || r.x > c.to + 1e-9) {
        issues.push({
          path: `${path}.x`,
          message: `${n(r.x)} est hors du tracé de ${name} (de ${n(c.from)} à ${n(c.to)}).`,
        })
        return
      }
      const y = f(r.x)
      if (!Number.isFinite(y)) {
        issues.push({
          path: `${path}.x`,
          message: `${name}(${n(r.x)}) n’existe pas : on ne peut pas lire cette image.`,
        })
      } else if (!inY(y)) {
        issues.push({
          path: `${path}.x`,
          message: `${name}(${n(r.x)}) = ${n(y)} sort du repère : élargis l’axe des ordonnées.`,
        })
      }
      return
    }
    if (r.y === undefined) {
      issues.push({ path, message: 'Une lecture donne x (image) ou y (antécédents).' })
      return
    }
    if (!inY(r.y)) {
      issues.push({
        path: `${path}.y`,
        message: `${n(r.y)} est hors de l’axe des ordonnées (de ${n(yAxis.from)} à ${n(yAxis.to)}).`,
      })
      return
    }
    if (solveFor(f, r.y, c.from, c.to).length === 0) {
      issues.push({
        path: `${path}.y`,
        message: `${n(r.y)} n’a pas d’antécédent par ${name} visible dans le repère.`,
      })
    }
  })

  return issues
}
