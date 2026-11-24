/**
 * Aiguillage des portes 4 à 6 (#449).
 *
 * Avant, chaque tour relançait les 10 gardiens et tous les contrôles locaux, quel que soit le
 * diff. Ces fonctions pures lisent le diff (chemins + lignes ajoutées) et appliquent les
 * déclencheurs « Se réveille » déjà écrits dans chaque fiche `.claude/agents/*.md` : chaque
 * gardien retenu l'est avec la raison (le fichier ou la ligne qui le réveille), chaque gardien
 * écarté l'est parce que rien dans le diff ne touche son périmètre.
 *
 * Prudence, dans cet ordre :
 *   1. un fichier que rien ne classe réveille V1 (et figure dans `nonClasses`) ;
 *   2. dans le doute, on inclut : les règles visent large, jamais au plus juste ;
 *   3. l'agent P4 peut AJOUTER un gardien sur raison concrète, jamais en retirer un retenu ici.
 */

const JAVA = 'backend/src/main/java/fr/brio/'

/** Fichiers de code (V1 relit tout code ; docs, contenu rédactionnel et JSON de données à part). */
const CODE =
  /\.(java|kt|ts|tsx|js|mjs|cjs|sql|sh|ya?ml|css)$|(^|\/)(Dockerfile|commit-msg|pre-push)$/
const TEST_FILE =
  /(Test[s]?|IT)\.java$|\.test\.(ts|tsx|mjs|js)$|\.spec\.ts$|(vitest|playwright)\.config\.ts$|^web\/vitest\.setup\.ts$/
const WEB_UI = /^web\/(app|components)\//
const STYLE = /\.css$/

/** Chemins connus mais sans gardien propre (docs, contenu rédactionnel, config du mesh). */
const CLASSES_SANS_GARDIEN = [
  /^docs\//,
  /^README\.md$/,
  /^content\/(README|AUTHORING)\.md$/,
  /^mesh\//,
  /^\.claude\//,
  /^evals\//,
  /\.md$/,
  /^pnpm-lock\.yaml$/,
  /^(package|turbo|tsconfig)\.json$/,
  /^web\/(package|tsconfig)\.json$/,
  /^web\/public\//,
  /^packages\/[^/]+\/package\.json$/,
]

/** Signaux de contenu (lignes ajoutées) : ce que les chemins seuls ne voient pas. */
const SIGNAUX = {
  // V5 : « PR affichant XP, niveaux, séries, pourcentages, verrous » / « suivi, analytics,
  // journal, export, appel à un service tiers ».
  surete: [
    [/\bxp\b|points? d'exp/i, 'affiche de l’XP'],
    [/\bs[ée]ries?\b|\bstreak/i, 'affiche une série'],
    [/pourcent|percentage|\bpct\b/i, 'affiche un pourcentage'],
    [/verrou|locked|d[ée]bloqu/i, 'verrou de chapitre'],
    [
      /analytics|\btracking\b(?!-)|\btrack\(|matomo|plausible|umami|posthog|gtag/i,
      'suivi / analytics',
    ],
    [/\bexport(er|s)?\b.*(csv|donn[ée]es|json)|download=/i, 'export de données'],
    [/consentement|r[ée]tention|purge|effacement|anonymis/i, 'consentement / rétention'],
    [
      /(fetch|axios\.\w+)\(\s*['"`]https?:\/\/|RestClient|WebClient|HttpClient\.new/i,
      'appel à un service tiers',
    ],
    [
      /mot de passe|password|\bjeton\b|\bcookies?\b|getSession|req\.session|HttpSession|SecurityContext/i,
      'authentification / session',
    ],
  ],
  // S3 : « PR touchant un formulaire, une session, un exercice ou la Communauté ».
  saboteur: [
    [/<form\b|onSubmit|useActionState|formAction|type=["']submit/, 'formulaire'],
    [/@(Post|Put|Patch|Delete)Mapping/, 'écriture côté API'],
  ],
}

const has = (files, re) => files.filter((f) => re.test(f.path))
/** Règles de périmètre : un test ne réveille que V1 et V3 (le reste juge le code testé). */
const hasSrc = (files, re) => has(files, re).filter((f) => !TEST_FILE.test(f.path))

/** Route Next.js d'un fichier `web/app/**` (« /[niveau]/[matiere] »), groupes retirés. */
export function routeOf(path) {
  const m = /^web\/app\/(.*)$/.exec(path)
  if (!m) return null
  const segs = m[1].split('/')
  segs.pop() // page.tsx, layout.tsx, loading.tsx, un composant local…
  const kept = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('_') && !s.startsWith('@'))
  return '/' + kept.join('/')
}

/** Routes chaudes (arrivée + étapes `via`) des tâches de `mesh/routes/tasks.json`. */
export function hotRoutes(def) {
  const out = new Set()
  for (const t of def?.taches ?? []) {
    if (!t.chaude) continue
    out.add(t.arrivee)
    for (const v of t.via ?? []) out.add(v)
  }
  return out
}

/** Une route touchée appartient-elle à une route chaude (elle-même ou un layout parent) ? */
function touchesHot(route, isLayout, hot) {
  for (const h of hot) {
    if (h === route) return true
    if (isLayout && (route === '/' || h.startsWith(route + '/'))) return true
  }
  return false
}

/** Tâches de tasks.json dont une route touchée est l'arrivée, une étape, ou un parent. */
export function tasksTouched(routes, def) {
  return (def?.taches ?? []).filter((t) =>
    [t.arrivee, ...(t.via ?? [])].some((r) =>
      routes.some((x) => x !== '/' && (r === x || r.startsWith(x + '/')))
    )
  )
}

/**
 * @param {{ path: string, status?: string }[]} files  fichiers du diff (status git : A, M, D, R…)
 * @param {Map<string, string[]>} added                lignes ajoutées, par fichier
 * @param {object} tasksDef                            contenu de mesh/routes/tasks.json
 */
export function aiguiller(files, added = new Map(), tasksDef = {}) {
  const agents = new Map()
  const want = (id, raison) => {
    const a = agents.get(id) ?? []
    if (!a.includes(raison)) a.push(raison)
    agents.set(id, a)
  }
  const list = (fs, max = 3) =>
    fs.length <= max
      ? fs.map((f) => f.path).join(', ')
      : `${fs
          .slice(0, max)
          .map((f) => f.path)
          .join(', ')} +${fs.length - max}`
  const linesOf = (fs) =>
    fs.flatMap((f) => (added.get(f.path) ?? []).map((l) => ({ path: f.path, l })))

  const code = has(files, CODE)
  const tests = has(files, TEST_FILE)
  const ui = hasSrc(files, WEB_UI)
  const styles = has(files, STYLE)

  // V1 — relecteur : tout code.
  if (code.length) want('V1', `code modifié : ${list(code)}`)

  // V2 — contrats.
  const contrats = hasSrc(
    files,
    new RegExp(
      `^${JAVA}[^/]+/(web|api)/|^docs/api/openapi\\.json$|^packages/api-client/|^web/e2e/fake-backend\\.mjs$`
    )
  )
  // web/lib : seulement les fichiers qui appellent l'API ou en valident la réponse (fiche V2).
  const API_CALL = /\/api\b|apiBaseUrl|fetch\(|createApiClient|z\.object|Schema\b/
  for (const f of hasSrc(files, /^web\/lib\//))
    if ((added.get(f.path) ?? []).some((l) => API_CALL.test(l))) contrats.push(f)
  if (contrats.length) want('V2', `contrat d'API ou appel /api : ${list(contrats)}`)

  // V3 — tests : un test touché (affaiblissement ?) ou du code source (verdict mutation).
  const deleted = tests.filter((f) => f.status?.startsWith('D'))
  if (deleted.length) want('V3', `test supprimé : ${list(deleted)}`)
  else if (tests.length) want('V3', `test modifié : ${list(tests)}`)
  const src = has(
    files,
    /^backend\/src\/main\/|^web\/(app|components|lib)\/|^packages\/[^/]+\/src\//
  ).filter((f) => !TEST_FILE.test(f.path))
  if (src.length) want('V3', `code source sous mutation : ${list(src)}`)

  // V4 — pédagogie.
  const pedago = hasSrc(
    files,
    new RegExp(
      `^content/(chapitres|annales|referentiel)/|^${JAVA}exercices/|^packages/content/src/`
    )
  )
  if (pedago.length) want('V4', `contenu ou évaluateur pédagogique : ${list(pedago)}`)

  // V5 — sûreté des mineurs : chemins sensibles, puis signaux dans les lignes ajoutées.
  const sensibles = hasSrc(
    files,
    new RegExp(
      `^${JAVA}(ia|identite|social)/|^backend/src/main/resources/ia/|^evals/tuteur/|` +
        `^backend/src/main/resources/db/migration/|consentement|/classes?/|ma-classe|rejoindre|communaute|moderation`
    )
  )
  if (sensibles.length)
    want('V5', `périmètre sensible (comptes, IA, social, données) : ${list(sensibles)}`)
  // Signaux lus dans le code de l'app seulement (pas l'outillage, pas les tests).
  const codeLines = linesOf(
    code.filter((f) => /^(web|backend|packages)\//.test(f.path) && !TEST_FILE.test(f.path))
  )
  for (const [re, label] of SIGNAUX.surete) {
    const hit = codeLines.find(({ l }) => re.test(l))
    if (hit) want('V5', `${label} (${hit.path})`)
  }

  // V6 — visuel ; U7 — accessibilité.
  const visuel = [...ui, ...styles.filter((f) => !WEB_UI.test(f.path))]
  if (visuel.length) {
    want('V6', `écran ou style modifié : ${list(visuel)}`)
    want('U7', `écran ou style modifié : ${list(visuel)}`)
  }

  // U1 — parcours.
  const parcours = hasSrc(
    files,
    /^web\/(app|components|lib)\/|^mesh\/routes\/tasks\.json$|^web\/middleware\.ts$/
  )
  if (parcours.length) want('U1', `navigation ou écran : ${list(parcours)}`)

  // U6 — fluidité : route chaude touchée, ou ce qui les sert toutes.
  const hot = hotRoutes(tasksDef)
  const hotFiles = files.filter((f) => {
    if (TEST_FILE.test(f.path)) return false
    // tasks.json : seulement si une ligne de tâche chaude a changé (le reste relève de U1).
    if (/^mesh\/routes\/tasks\.json$/.test(f.path))
      return (added.get(f.path) ?? []).some((l) => /"chaude":\s*true/.test(l))
    if (/^web\/(middleware\.ts|next\.config\.ts)$/.test(f.path)) return true
    const r = routeOf(f.path)
    return r !== null && touchesHot(r, /\/(layout|template)\.tsx$/.test(f.path), hot)
  })
  if (hotFiles.length) want('U6', `route chaude ou son layout : ${list(hotFiles)}`)

  // S2 — personas : la tâche touchée, pas tout le catalogue.
  const routes = [...new Set(files.map((f) => routeOf(f.path)).filter(Boolean))]
  const taches = tasksTouched(routes, tasksDef)
  if (ui.length) {
    want(
      'S2',
      taches.length
        ? `tâches touchées : ${taches.map((t) => t.id).join(', ')}`
        : `écran modifié hors tâches clés : un seul persona sur l'écran touché (${list(ui)})`
    )
  }

  // S3 — saboteur.
  const cibles = has(
    files,
    new RegExp(
      `^${JAVA}(identite|exercices|social)/|form|session|exercice|communaute|connexion|mot-de-passe`,
      'i'
    )
  ).filter((f) => !TEST_FILE.test(f.path) && !/\.md$/.test(f.path))
  if (cibles.length) want('S3', `formulaire, session, exercice ou Communauté : ${list(cibles)}`)
  for (const [re, label] of SIGNAUX.saboteur) {
    const hit = codeLines.find(({ l }) => re.test(l))
    if (hit) want('S3', `${label} (${hit.path})`)
  }

  // Fichiers que rien ne classe : V1 les relit, et on les montre.
  const nonClasses = files.filter(
    (f) =>
      !CODE.test(f.path) &&
      !CLASSES_SANS_GARDIEN.some((re) => re.test(f.path)) &&
      !/^content\//.test(f.path)
  )
  if (nonClasses.length) want('V1', `fichier non classé, relu par prudence : ${list(nonClasses)}`)

  return {
    agents: ORDRE.map((id) => ({
      id,
      retenu: agents.has(id),
      raisons: agents.get(id) ?? [PERIMETRE[id]],
    })),
    controles: controles(files, routes),
    taches: taches.map((t) => t.id),
    nonClasses: nonClasses.map((f) => f.path),
  }
}

export const ORDRE = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'U1', 'U6', 'U7', 'S2', 'S3']

/** Pourquoi un gardien est écarté : rien du diff dans son périmètre (rappel du périmètre). */
const PERIMETRE = {
  V1: 'aucun fichier de code',
  V2: 'aucun DTO, openapi.json, api-client, faux backend ni web/lib',
  V3: 'aucun test ni code source sous mutation',
  V4: 'aucun contenu pédagogique ni évaluateur',
  V5: 'aucun périmètre sensible ni signal (XP, série, %, suivi, export, tiers, session)',
  V6: 'aucun écran ni style',
  U1: 'aucun écran, lien ni tasks.json',
  U6: 'aucune route chaude ni son layout',
  U7: 'aucun écran ni style',
  S2: 'aucun écran modifié',
  S3: 'aucun formulaire, session, exercice ni Communauté',
}

/**
 * Contrôles locaux de la porte 4. Les garde-fous du mesh (quelques secondes) tournent
 * toujours ; les contrôles lourds seulement si leur périmètre bouge.
 */
export function controles(files, routes = []) {
  const any = (re) => files.some((f) => re.test(f.path))
  const out = [
    {
      id: 'garde-fous',
      cmd: 'for f in scripts/mesh/__tests__/*.test.mjs; do node --test "$f" || exit 1; done && node scripts/mesh/route-budget.mjs --base origin/develop && node scripts/mesh/check-numerotation.mjs --base origin/develop --open-prs',
      retenu: true,
      raison: 'toujours (quelques secondes)',
    },
  ]
  const backend = any(/^backend\//)
  out.push({
    id: 'backend',
    cmd: '(cd backend && ./mvnw verify)',
    retenu: backend,
    raison: backend ? 'backend modifié' : 'aucun fichier backend',
  })
  const web = any(/^web\/|^packages\//)
  out.push({
    id: 'web',
    cmd: 'pnpm --filter web test && pnpm --filter web lint',
    retenu: web,
    raison: web ? 'web ou packages modifiés' : 'aucun fichier web ni packages',
  })
  const content = any(/^content\/|^packages\/content\/|^scripts\/check-content\.mjs$/)
  out.push({
    id: 'contenu',
    cmd: 'pnpm check:content',
    retenu: content,
    raison: content ? 'contenu ou son schéma modifié' : 'aucun contenu',
  })
  const contrats = any(/^docs\/api\/openapi\.json$|^packages\/api-client\//)
  out.push({
    id: 'contrats',
    cmd: 'pnpm generate:api && git diff --exit-code packages/api-client',
    retenu: contrats,
    raison: contrats ? 'contrat d’API modifié' : 'aucun contrat d’API',
  })
  const e2eAll = any(
    /^web\/e2e\/fake-backend\.mjs$|^web\/playwright\.config\.ts$|^packages\/|^web\/(lib|middleware)/
  )
  const specs = files.filter((f) => /^web\/e2e\/.*\.spec\.ts$/.test(f.path)).map((f) => f.path)
  const e2e = e2eAll || specs.length > 0 || routes.length > 0 || any(/^web\/components\//)
  out.push({
    id: 'e2e',
    cmd: e2eAll
      ? 'pnpm --filter web exec playwright test'
      : 'pnpm --filter web exec playwright test <specs qui visitent les routes touchées>',
    retenu: e2e,
    raison: e2eAll
      ? 'faux backend, config ou code partagé modifié : suite complète'
      : e2e
        ? `ciblés : specs modifiées${specs.length ? ` (${specs.join(', ')})` : ''} + celles qui visitent ${routes.join(', ') || 'les écrans touchés'}`
        : 'aucun écran ni code web',
  })
  return out
}

/** Lignes ajoutées par fichier, depuis un diff unifié. */
export function addedLines(patch) {
  const map = new Map()
  let cur = null
  for (const line of patch.split('\n')) {
    const h = /^\+\+\+ (?:b\/)?(.+)$/.exec(line)
    if (h) {
      cur = h[1] === '/dev/null' ? null : h[1]
      if (cur && !map.has(cur)) map.set(cur, [])
      continue
    }
    if (cur && line.startsWith('+') && !line.startsWith('+++')) map.get(cur).push(line.slice(1))
  }
  return map
}

/** Rendu Markdown pour le commentaire consolidé de la porte 5. */
export function render(result) {
  const r = result.agents.filter((a) => a.retenu)
  const e = result.agents.filter((a) => !a.retenu)
  const out = ['### Aiguillage', '', `**Gardiens lancés (${r.length})**`]
  for (const a of r) out.push(`- **${a.id}** — ${a.raisons.join(' ; ')}`)
  out.push('', `**Gardiens écartés (${e.length})**`)
  for (const a of e) out.push(`- ${a.id} — ${a.raisons[0]}`)
  out.push('', '**Contrôles locaux**')
  for (const c of result.controles)
    out.push(
      `- ${c.retenu ? '✅' : '⏭️'} ${c.id} — ${c.raison}${c.retenu ? `\n  \`${c.cmd}\`` : ''}`
    )
  if (result.nonClasses.length)
    out.push('', `⚠️ Non classés (relus par V1) : ${result.nonClasses.join(', ')}`)
  return out.join('\n')
}
