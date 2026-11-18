// Shared helpers for the verification scripts (mesh Phase 3, #358). No dependency.
// Contract: mesh/verification/verdict.schema.json

export const SEVERITIES = ['blocking', 'important', 'suggestion']

/** The verdict a set of findings implies: veto iff any blocking finding. */
export function deriveVerdict(findings) {
  if (findings.some((f) => f.severity === 'blocking')) return 'veto'
  return findings.length > 0 ? 'advisory' : 'pass'
}

export function makeVerdict(guardian, name, findings, summary, extra = {}) {
  return {
    guardian,
    name,
    verdict: deriveVerdict(findings),
    summary,
    findings,
    ...(process.env.GITHUB_SHA ? { head_sha: process.env.GITHUB_SHA } : {}),
    ...extra,
  }
}

/** Minimal structural validation of a verdict (the JSON Schema is the reference). */
export function validateVerdict(v) {
  const errors = []
  if (!v || typeof v !== 'object') return ['verdict is not an object']
  if (!/^(V[1-6]|U[67])$/.test(v.guardian ?? '')) errors.push(`guardian invalide : ${v.guardian}`)
  if (!['pass', 'advisory', 'veto'].includes(v.verdict)) errors.push(`verdict invalide : ${v.verdict}`)
  if (!Array.isArray(v.findings)) errors.push('findings doit être un tableau')
  else
    v.findings.forEach((f, i) => {
      if (!SEVERITIES.includes(f?.severity)) errors.push(`findings[${i}].severity invalide`)
      if (typeof f?.message !== 'string' || !f.message) errors.push(`findings[${i}].message manquant`)
      if (f?.line !== undefined && !(Number.isInteger(f.line) && f.line >= 1))
        errors.push(`findings[${i}].line invalide`)
    })
  return errors
}

/** `fichier:ligne`, or `fichier`, or `—`. */
export function location(f) {
  if (!f.file) return '—'
  return f.line ? `${f.file}:${f.line}` : f.file
}
