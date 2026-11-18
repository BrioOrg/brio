/**
 * Click budget — compares the click depth of the key tasks with their budget (#358, U1).
 *
 * `mesh/routes/tasks.json` is the contract: for each key task, where the user starts, where
 * they must end, the most clicks allowed (`budget`), and the clicks wanted (`cible`).
 * This module turns the route graph into a verdict; `scripts/mesh/route-budget.mjs` is its CLI.
 */
import { buildGraph, depthsFrom, pathTo } from './route-graph.mjs'

function under(prefix, pattern) {
  return pattern === prefix || pattern.startsWith(`${prefix}/`)
}

/** Whether a persona may walk through a route (its own entry is always allowed). */
export function allowedFor(persona) {
  const { autorise, exclut = [] } = persona
  return (pattern) => {
    if (exclut.some((p) => under(p, pattern))) return false
    if (autorise && !autorise.some((p) => under(p, pattern))) return false
    return true
  }
}

export function validateTasks(def) {
  const errors = []
  if (def?.version !== 1) errors.push('tasks.json : "version" doit valoir 1')
  const personas = def?.personas ?? {}
  const ids = new Set()
  for (const t of def?.taches ?? []) {
    if (ids.has(t.id)) errors.push(`tâche en double : ${t.id}`)
    ids.add(t.id)
    if (!personas[t.persona]) errors.push(`${t.id} : persona inconnu « ${t.persona} »`)
    if (!t.arrivee) errors.push(`${t.id} : "arrivee" manquante`)
    if (!Number.isInteger(t.budget) || t.budget < 0)
      errors.push(`${t.id} : "budget" doit être un entier ≥ 0`)
    if (!Number.isInteger(t.cible) || t.cible < 0)
      errors.push(`${t.id} : "cible" doit être un entier ≥ 0`)
    else if (Number.isInteger(t.budget) && t.cible > t.budget) {
      errors.push(`${t.id} : la cible (${t.cible}) ne peut pas dépasser le budget (${t.budget})`)
    }
  }
  for (const [name, p] of Object.entries(personas)) {
    if (!p.entree) errors.push(`persona ${name} : "entree" manquante`)
  }
  return errors
}

/**
 * Compute every task's depth and the violations of the contract.
 * @param {string} webDir
 * @param {object} def parsed tasks.json
 */
export function evaluate(webDir, def) {
  const graph = buildGraph(webDir)
  const known = new Set(graph.routes.map((r) => r.pattern))
  const errors = validateTasks(def)
  const legCache = new Map()
  const leg = (personaName, from) => {
    const key = `${personaName}|${from}`
    if (!legCache.has(key)) {
      legCache.set(key, depthsFrom(graph, from, allowedFor(def.personas[personaName])))
    }
    return legCache.get(key)
  }

  const taches = (def.taches ?? [])
    .filter((t) => def.personas?.[t.persona])
    .map((t) => {
      const persona = def.personas[t.persona]
      const stops = [persona.entree, ...(t.via ?? []), t.arrivee]
      for (const stop of stops) {
        if (!known.has(stop))
          errors.push(`${t.id} : la route « ${stop} » n'existe pas dans web/app`)
      }
      let depth = 0
      const hops = []
      for (let i = 0; i < stops.length - 1 && depth !== null; i++) {
        const { dist, prev } = leg(t.persona, stops[i])
        if (!dist.has(stops[i + 1])) depth = null
        else {
          depth += dist.get(stops[i + 1])
          hops.push(...pathTo(prev, stops[i], stops[i + 1]))
        }
      }
      let statut = 'ok'
      if (depth === null) statut = 'inaccessible'
      else if (depth > t.budget) statut = 'depasse'
      return { ...t, profondeur: depth, statut, chemin: depth === null ? [] : hops }
    })

  const violations = [...errors]
  for (const t of taches) {
    if (t.statut === 'inaccessible') {
      violations.push(
        `${t.id} : impasse — « ${t.arrivee} » n'est plus atteignable depuis « ${def.personas[t.persona].entree} »`
      )
    } else if (t.statut === 'depasse') {
      violations.push(
        `${t.id} : ${t.profondeur} clics pour un budget de ${t.budget}${t.chaude ? ' (route chaude)' : ''} — « ${t.label} »`
      )
    }
  }

  // Routes no persona can ever reach, apart from the ones declared reached by other means
  // (an e-mail link, a developer page).
  const reachable = new Set()
  for (const [name, p] of Object.entries(def.personas ?? {})) {
    for (const route of leg(name, p.entree).dist.keys()) reachable.add(route)
  }
  const horsNav = new Set(def.attendus?.horsNavigation ?? [])
  const orphelines = graph.routes.map((r) => r.pattern).filter((p) => !reachable.has(p))
  for (const p of orphelines) {
    if (!horsNav.has(p))
      violations.push(`route orpheline : « ${p} » n'est atteignable depuis aucune entrée (impasse)`)
  }
  const surplusHorsNav = [...horsNav].filter((p) => !orphelines.includes(p))

  const liensMortsAttendus = new Set(def.attendus?.liensMorts ?? [])
  const liensMorts = [...graph.deadLinks].map(([path, files]) => ({
    path,
    fichiers: [...files].sort(),
  }))
  for (const l of liensMorts) {
    if (!liensMortsAttendus.has(l.path)) {
      violations.push(`lien mort : « ${l.path} » (${l.fichiers[0]}) ne mène à aucune page`)
    }
  }
  const liensMortsResolus = [...liensMortsAttendus].filter((p) => !graph.deadLinks.has(p))

  const entrees = {}
  for (const [name, p] of Object.entries(def.personas ?? {})) {
    const { dist } = leg(name, p.entree)
    entrees[name] = graph.routes
      .map((r) => ({ route: r.pattern, profondeur: dist.get(r.pattern) ?? null }))
      .sort((a, b) => (a.profondeur ?? 99) - (b.profondeur ?? 99) || a.route.localeCompare(b.route))
  }

  return {
    routes: graph.routes.map((r) => r.pattern).sort(),
    taches,
    entrees,
    orphelines,
    liensMorts,
    notes: {
      horsNavigationObsolete: surplusHorsNav,
      liensMortsResolus,
      resserrables: taches
        .filter((t) => t.profondeur !== null && t.profondeur < t.budget)
        .map((t) => t.id),
    },
    violations,
  }
}

/**
 * The ratchet across branches: a hot task's budget may never be raised, and a hot task may
 * not be removed or demoted, in a PR that does not carry an explicit U1/human decision.
 * @param {object} baseDef tasks.json on the base branch
 * @param {object} def tasks.json on this branch
 */
export function compareToBase(baseDef, def) {
  const out = []
  const now = new Map((def.taches ?? []).map((t) => [t.id, t]))
  for (const before of baseDef?.taches ?? []) {
    if (!before.chaude) continue
    const after = now.get(before.id)
    if (!after)
      out.push(`${before.id} : tâche chaude retirée de tasks.json — décision U1 + humain requise`)
    else if (!after.chaude)
      out.push(`${before.id} : n'est plus marquée chaude — décision U1 + humain requise`)
    else if (after.budget > before.budget) {
      out.push(
        `${before.id} : budget relevé de ${before.budget} à ${after.budget} — une route chaude ne s'allonge pas (décision U1 + humain requise)`
      )
    }
  }
  return out
}

// ── Rendering ──────────────────────────────────────────────────────────────────────────────

const ICON = { ok: '✅', depasse: '❌', inaccessible: '⛔' }

function cell(s) {
  return String(s).replaceAll('|', '\\|')
}

export function renderSummary(result, def, { title = 'Budget de clics' } = {}) {
  const L = []
  L.push(`### ${title}`, '')
  L.push(
    '| | Tâche | Persona | Chaude | Clics | Budget | Cible |',
    '|---|---|---|---|---:|---:|---:|'
  )
  for (const t of result.taches) {
    const clics = t.profondeur === null ? '∅' : t.profondeur
    L.push(
      `| ${ICON[t.statut]} | ${cell(t.label)} (\`${t.id}\`) | ${t.persona} | ${t.chaude ? '🔥' : ''} | ${clics} | ${t.budget} | ${t.cible} |`
    )
  }
  L.push('')
  if (result.violations.length) {
    L.push('**Violations**', '', ...result.violations.map((v) => `- ${v}`), '')
  } else {
    L.push('Aucune violation : toutes les tâches tiennent dans leur budget.', '')
  }
  const hints = []
  if (result.notes.resserrables.length) {
    hints.push(
      `budget resserrable (profondeur < budget) : ${result.notes.resserrables.map((i) => `\`${i}\``).join(', ')}`
    )
  }
  if (result.notes.horsNavigationObsolete.length) {
    hints.push(
      `\`attendus.horsNavigation\` obsolète : ${result.notes.horsNavigationObsolete.join(', ')}`
    )
  }
  if (result.notes.liensMortsResolus.length) {
    hints.push(
      `\`attendus.liensMorts\` résolu, à retirer : ${result.notes.liensMortsResolus.join(', ')}`
    )
  }
  if (hints.length) L.push('**À nettoyer**', '', ...hints.map((h) => `- ${h}`), '')
  return L.join('\n')
}

/** The published route map (docs/mesh/CARTE-ROUTES.md). Deterministic: no date, no random. */
export function renderMap(result, def) {
  const L = []
  L.push('# Carte des routes et budget de clics', '')
  L.push(
    '> **Généré** par `node scripts/mesh/route-budget.mjs --write-doc` — ne pas éditer à la main.',
    '> Source des tâches et budgets : [`mesh/routes/tasks.json`](../../mesh/routes/tasks.json).',
    '> Propriétaire : U1 Cartographe des parcours. Méthode et limites : [`ROUTES-BUDGET.md`](ROUTES-BUDGET.md).',
    ''
  )
  L.push('## Tâches clés', '')
  L.push(
    'Un **clic** = un lien suivi ; une page qui ne fait que rediriger coûte 0. `Clics` est le plus court chemin trouvé dans le code ; `Budget` est le plafond que la CI fait respecter ; `Cible` est ce que U1 vise.',
    ''
  )
  L.push(
    '| Tâche | Persona | Chaude | Clics | Budget | Cible | Chemin |',
    '|---|---|---|---:|---:|---:|---|'
  )
  for (const t of result.taches) {
    const chemin =
      t.profondeur === null
        ? '**impasse**'
        : [def.personas[t.persona].entree, ...t.chemin.map((h) => h.to)]
            .map((p) => `\`${p}\``)
            .join(' → ')
    const clics = t.profondeur === null ? '∅' : t.profondeur
    L.push(
      `| ${cell(t.label)} | ${t.persona} | ${t.chaude ? '🔥' : ''} | ${clics} | ${t.budget} | ${t.cible} | ${chemin} |`
    )
  }
  L.push('')
  const loin = result.taches.filter((t) => t.profondeur !== null && t.profondeur > t.cible)
  if (loin.length) {
    L.push(
      '**Au-dessus de la cible** (à traiter par U1/U3, pas bloquant) : ' +
        loin.map((t) => `\`${t.id}\` (${t.profondeur} → ${t.cible})`).join(', '),
      ''
    )
  }
  for (const [name, rows] of Object.entries(result.entrees)) {
    L.push(
      `## Profondeur de chaque route — entrée « ${name} » (\`${def.personas[name].entree}\`)`,
      ''
    )
    L.push('| Clics | Route |', '|---:|---|')
    for (const r of rows) {
      if (r.profondeur === null) continue
      L.push(`| ${r.profondeur} | \`${r.route}\` |`)
    }
    L.push('')
  }
  L.push('## Impasses connues', '')
  L.push(
    result.orphelines.length
      ? "Routes qu'aucune entrée n'atteint par un lien : " +
          result.orphelines.map((p) => `\`${p}\``).join(', ') +
          '. Déclarées « hors navigation » dans `tasks.json` (`attendus.horsNavigation`) quand elles sont atteintes autrement (lien de courriel, page de développement).'
      : 'Aucune route orpheline.',
    ''
  )
  L.push(
    result.liensMorts.length
      ? "Liens morts (un `href` vers une page qui n'existe pas) : " +
          result.liensMorts.map((l) => `\`${l.path}\` (${l.fichiers.join(', ')})`).join(' ; ') +
          '.'
      : 'Aucun lien mort.',
    ''
  )
  return L.join('\n')
}
