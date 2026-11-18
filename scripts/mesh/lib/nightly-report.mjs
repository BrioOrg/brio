/**
 * Nightly simulation report (#358): S2 persona runs + S3 saboteur runs → one report.
 *
 * Input : run files (`mesh/nuit/run.schema.json`), one JSON per persona × task, played on
 *         staging against the reset database — never on real pupils' data.
 * Output: a report object (rendered to Markdown by `renderReport`), compared with the
 *         previous night's report. A rise in friction reopens the PR (S4 → L1).
 *
 * Pure functions, no I/O: the CLI (`scripts/mesh/nightly-report.mjs`) reads and writes.
 */

export const FRICTION_WEIGHTS = {
  impasse: 5,
  'triche-acceptee': 6,
  erreur: 4,
  a11y: 3,
  ambigu: 2,
  detour: 1,
  lent: 1,
}
export const FAILURE_SCORE = { echec: 10, abandon: 8, casse: 10 }
export const OVER_BUDGET_CLICK = 2
/** Day-over-day rise of the global friction score that counts as a regression (noise margin). */
export const REGRESSION_MARGIN = 0.5

const RESULTS = { persona: ['reussi', 'echec', 'abandon'], sabotage: ['tenu', 'casse'] }
const ATTACKS = [
  'retour-arriere',
  'double-clic',
  'session-expiree',
  'triche',
  'saisie-hostile',
  'connexion-lente',
]
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/

/** @returns {string[]} the problems of one run file (empty when valid) */
export function validateRun(run, name = 'run') {
  const e = []
  const need = (cond, msg) => cond || e.push(`${name} : ${msg}`)
  need(run?.version === 1, '"version" doit valoir 1')
  need(['persona', 'sabotage'].includes(run?.kind), '"kind" doit valoir persona ou sabotage')
  need(
    run?.env === 'staging' || run?.env === 'ci',
    '"env" doit valoir staging ou ci (jamais la production)'
  )
  for (const f of ['run_id', 'date', 'commit', 'agent', 'persona', 'tache']) {
    need(typeof run?.[f] === 'string' && run[f], `"${f}" manquant`)
  }
  need(Array.isArray(run?.etapes), '"etapes" doit être un tableau')
  need(Array.isArray(run?.frictions), '"frictions" doit être un tableau')
  if (RESULTS[run?.kind])
    need(RESULTS[run.kind].includes(run.resultat), `"resultat" invalide pour ${run.kind}`)
  if (run?.kind === 'sabotage')
    need(ATTACKS.includes(run.attaque), `"attaque" doit être parmi ${ATTACKS.join(', ')}`)
  need(Number.isInteger(run?.budget) && run.budget >= 0, '"budget" doit être un entier')
  if (run?.resultat === 'reussi')
    need(Number.isInteger(run.clics), '"clics" requis quand la tâche est réussie')
  for (const fr of run?.frictions ?? []) {
    need(fr.type in FRICTION_WEIGHTS, `type de friction inconnu « ${fr.type} »`)
    need(typeof fr.route === 'string' && fr.route.startsWith('/'), 'friction sans "route"')
  }
  // Doctrine 6 / RGPD: a run carries no personal data. Personas are fictional; refuse an e-mail.
  need(
    !EMAIL.test(JSON.stringify(run ?? {})),
    'une adresse e-mail apparaît : aucune donnée nominative dans un run'
  )
  return e
}

export function runScore(run) {
  let score = 0
  const failed = run.resultat in FAILURE_SCORE
  if (failed) score += FAILURE_SCORE[run.resultat]
  else if (run.kind === 'persona' && run.clics > run.budget)
    score += OVER_BUDGET_CLICK * (run.clics - run.budget)
  for (const f of run.frictions) score += FRICTION_WEIGHTS[f.type]
  return score
}

const median = (xs) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const round = (x) => Math.round(x * 100) / 100
export const fingerprint = (f, tache) => `${f.type}|${f.route}|${tache}`

/**
 * @param {object[]} runs validated runs of one night
 * @param {object|null} previous the previous report (`rapport.json`), if any
 * @param {string[]} [expectedTasks] ids from mesh/routes/tasks.json — those never played are listed
 */
export function buildReport(runs, previous = null, expectedTasks = []) {
  const first = runs[0] ?? {}
  const byTask = new Map()
  for (const r of runs) {
    if (!byTask.has(r.tache)) byTask.set(r.tache, [])
    byTask.get(r.tache).push(r)
  }

  const taches = [...byTask]
    .map(([id, rs]) => {
      const persona = rs.filter((r) => r.kind === 'persona')
      const sabotage = rs.filter((r) => r.kind === 'sabotage')
      const reussis = persona.filter((r) => r.resultat === 'reussi')
      return {
        id,
        runs: rs.length,
        reussite: persona.length ? round(reussis.length / persona.length) : null,
        clics_mediane: median(reussis.map((r) => r.clics)),
        budget: rs[0].budget,
        hors_budget: reussis.filter((r) => r.clics > r.budget).length,
        sabotages_casses: sabotage.filter((r) => r.resultat === 'casse').length,
        score: round(rs.reduce((n, r) => n + runScore(r), 0) / rs.length),
      }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  // One entry per distinct friction, with the steps of the first run that hit it.
  const frictionMap = new Map()
  for (const r of runs) {
    const fails = r.resultat in FAILURE_SCORE
    const own = r.frictions.map((f) => ({ ...f, tache: r.tache }))
    if (fails && !own.some((f) => f.type === 'impasse')) {
      own.push({
        type: r.kind === 'sabotage' ? 'erreur' : 'impasse',
        route: r.etapes.at(-1)?.route ?? '/',
        detail: `tâche non terminée (${r.resultat})`,
        tache: r.tache,
      })
    }
    for (const f of own) {
      const key = fingerprint(f, f.tache)
      if (!frictionMap.has(key)) {
        frictionMap.set(key, {
          ...f,
          cle: key,
          occurrences: 0,
          personas: new Set(),
          repro: {
            run_id: r.run_id,
            persona: r.persona,
            attaque: r.attaque ?? null,
            etapes: r.etapes,
          },
        })
      }
      const entry = frictionMap.get(key)
      entry.occurrences += 1
      entry.personas.add(r.persona)
    }
  }
  const previousKeys = new Set((previous?.frictions ?? []).map((f) => f.cle))
  const frictions = [...frictionMap.values()]
    .map((f) => ({
      ...f,
      personas: [...f.personas].sort(),
      nouvelle: previous ? !previousKeys.has(f.cle) : false,
      poids: FRICTION_WEIGHTS[f.type],
    }))
    .sort(
      (a, b) => b.poids - a.poids || b.occurrences - a.occurrences || a.cle.localeCompare(b.cle)
    )

  const scoreGlobal = runs.length
    ? round(runs.reduce((n, r) => n + runScore(r), 0) / runs.length)
    : 0
  const delta = previous ? round(scoreGlobal - previous.score_global) : null
  const nouvellesBloquantes = frictions.filter(
    (f) => f.nouvelle && (f.type === 'impasse' || f.type === 'triche-acceptee')
  )
  const casses = runs.filter((r) => r.resultat === 'casse')
  const prevTasks = new Map((previous?.taches ?? []).map((t) => [t.id, t]))
  const reussiteEnBaisse = taches
    .filter(
      (t) =>
        t.reussite !== null &&
        prevTasks.get(t.id)?.reussite != null &&
        t.reussite < prevTasks.get(t.id).reussite
    )
    .map((t) => t.id)

  const regression = Boolean(
    previous && (delta > REGRESSION_MARGIN || nouvellesBloquantes.length || reussiteEnBaisse.length)
  )
  const bloquant =
    frictions.some((f) => f.type === 'impasse' || f.type === 'triche-acceptee') || casses.length > 0
  const verdict = regression || bloquant ? 'rouge' : frictions.length ? 'orange' : 'vert'

  return {
    version: 1,
    date: first.date ?? null,
    commit: first.commit ?? null,
    env: first.env ?? null,
    runs: runs.length,
    personas: [...new Set(runs.filter((r) => r.kind === 'persona').map((r) => r.persona))].sort(),
    attaques: [...new Set(runs.filter((r) => r.kind === 'sabotage').map((r) => r.attaque))].sort(),
    score_global: scoreGlobal,
    score_precedent: previous?.score_global ?? null,
    delta,
    regression,
    verdict,
    taches,
    frictions,
    non_jouees: expectedTasks.filter((id) => !byTask.has(id)).sort(),
    taches_en_baisse: reussiteEnBaisse,
  }
}

const cell = (s) => String(s ?? '').replaceAll('|', '\\|')
const VERDICT = { vert: '🟢 vert', orange: '🟠 orange', rouge: '🔴 rouge' }

export function renderReport(r) {
  const L = []
  L.push(`# Rapport de nuit — ${r.date ?? '?'}`, '')
  L.push(
    `**Verdict : ${VERDICT[r.verdict]}**${r.regression ? ' · **régression** par rapport à la nuit précédente' : ''}`,
    ''
  )
  L.push(
    '| Commit | Environnement | Runs | Personas | Sabotages | Score de friction | Veille |',
    '|---|---|---:|---:|---:|---:|---:|'
  )
  const veille = r.delta === null ? 'n/a' : `${r.delta > 0 ? '+' : ''}${r.delta}`
  L.push(
    `| \`${r.commit}\` | ${r.env} | ${r.runs} | ${r.personas.length} | ${r.attaques.length} | ${r.score_global} | ${veille} |`,
    ''
  )

  L.push('## Tâches clés', '')
  L.push(
    '| Tâche | Runs | Réussite | Clics (méd.) | Budget | Hors budget | Sabotages cassés | Score |',
    '|---|---:|---:|---:|---:|---:|---:|---:|'
  )
  for (const t of r.taches) {
    const reussite = t.reussite === null ? '—' : `${Math.round(t.reussite * 100)} %`
    L.push(
      `| \`${t.id}\` | ${t.runs} | ${reussite} | ${t.clics_mediane ?? '—'} | ${t.budget} | ${t.hors_budget} | ${t.sabotages_casses} | ${t.score} |`
    )
  }
  L.push('')
  if (r.non_jouees.length)
    L.push(
      `**Tâches non jouées cette nuit** : ${r.non_jouees.map((i) => `\`${i}\``).join(', ')}`,
      ''
    )
  if (r.taches_en_baisse.length)
    L.push(
      `**Taux de réussite en baisse** : ${r.taches_en_baisse.map((i) => `\`${i}\``).join(', ')}`,
      ''
    )

  L.push('## Frictions', '')
  if (!r.frictions.length) L.push('Aucune friction relevée.', '')
  else {
    L.push(
      '| | Type | Route | Tâche | Détail | Vues | Personas |',
      '|---|---|---|---|---|---:|---|'
    )
    for (const f of r.frictions) {
      L.push(
        `| ${f.nouvelle ? '🆕' : ''} | ${f.type} | \`${f.route}\` | \`${f.tache}\` | ${cell(f.detail)} | ${f.occurrences} | ${f.personas.join(', ')} |`
      )
    }
    L.push('')
  }

  const aOuvrir = r.frictions.filter(
    (f) => f.nouvelle || f.type === 'impasse' || f.type === 'triche-acceptee'
  )
  L.push('## Tickets à ouvrir (S4 → `mesh:inbox`)', '')
  if (!aOuvrir.length) L.push('Aucun.', '')
  for (const f of aOuvrir) {
    L.push(`### ${f.type} · \`${f.route}\` · \`${f.tache}\``, '', f.detail, '')
    L.push(
      `Reproduction (run \`${f.repro.run_id}\`, persona \`${f.repro.persona}\`${f.repro.attaque ? `, attaque \`${f.repro.attaque}\`` : ''}, commit \`${r.commit}\`, ${r.env}) :`,
      ''
    )
    f.repro.etapes.forEach((e) =>
      L.push(
        `${e.n}. ${e.action} — ${e.cible ?? ''} (\`${e.route}\`)${e.observation ? ` → ${e.observation}` : ''}`
      )
    )
    L.push('')
  }
  L.push(
    '---',
    '',
    "_Simulation sur staging remis à zéro, personas fictifs : aucune donnée d'élève réel. Barème : `docs/mesh/RAPPORT-DE-NUIT.md`._",
    ''
  )
  return L.join('\n')
}
