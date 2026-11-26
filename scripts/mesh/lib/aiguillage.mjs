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
  /\.(java|kt|ts|tsx|js|mjs|cjs|sql|sh|ya?ml|css|properties)$|(^|\/)(Dockerfile|commit-msg|pre-push|pom\.xml)$/
const TEST_FILE =
  /Test[^/]*\.java$|IT\.java$|^backend\/src\/test\/|\.test\.(ts|tsx|mjs|js)$|^web\/e2e\/(?!fake-backend\.mjs$)|(vitest|playwright)\.config\.ts$|^web\/vitest\.setup\.ts$/
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
  /^web\/public\//,
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
    [/brio\.ia\./, 'réglage du modèle IA (eval obligatoire)'],
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
    [/JSESSIONID|PUBLIC_PREFIXES|cookies\(\)/, 'session'],
    [/@(Post|Put|Patch|Delete)Mapping/, 'écriture côté API'],
  ],
}

const has = (files, re) => files.filter((f) => re.test(f.path))
/** Règles de périmètre : un test ne réveille que V1 et V3 (le reste juge le code testé). */
const hasSrc = (files, re) => has(files, re).filter((f) => !TEST_FILE.test(f.path))

/**
 * « Texte seul » (#456) : dans un fichier web, seuls des textes ont changé (libellés, phrases,
 * commentaires). On efface de chaque ligne retirée et ajoutée les chaînes qui ressemblent à du
 * texte (une espace ou une lettre accentuée), le texte JSX entre balises et les commentaires,
 * puis on compare le reste, espaces compris retirés : identique = rien d'autre n'a bougé.
 * Prudence : chemins, classes CSS sans espace, regex, nombres et conditions restent comparés.
 */
const TEXTE_SEUL_FICHIER = /^web\/(app|components|lib)\/.*\.tsx?$/
const TEXTUEL = /\s|[À-ÿ’]/
// Un seul mot affiché (« 'Signalements' ») : une majuscule puis des minuscules.
const MOT_AFFICHE = /^['"][A-ZÀ-Ý][a-zà-ÿ]+['"]$/
// Ligne de texte JSX nue (« Voir les cours de ta classe ») : des mots, pas une instruction.
const TEXTE_JSX = /[A-Za-zÀ-ÿ]{2}.*\s|[À-ÿ’]/
const MOT_CLE =
  /^(return|export|import|const|let|var|await|throw|if|else|case|default|new|typeof|yield|async|function|class|interface|type|break|continue)\b/
function squelette(line) {
  const t = line.trim()
  if (/^(\/\/|\/\*|\*)/.test(t)) return ''
  return t
    .replace(/`([^`\\]|\\.)*`/g, (m) =>
      TEXTUEL.test(m) ? '`' + (m.match(/\$\{[^}]*\}/g) ?? []).join('') + '`' : m
    )
    .replace(/'([^'\\\n]|\\.)*'|"([^"\\\n]|\\.)*"/g, (m) =>
      TEXTUEL.test(m) || MOT_AFFICHE.test(m) ? "''" : m
    )
    .replace(/>([^<>{}()=;&|[\]`'"]*)</g, (m, txt) => (TEXTUEL.test(txt) ? '><' : m))
    .replace(/^[^<>{}()=;&|[\]`'"]*$/, (m) => (TEXTE_JSX.test(m) && !MOT_CLE.test(m) ? '' : m))
    .replace(/\s+/g, '')
}
export function texteSeul(path, added = [], removed = []) {
  if (!TEXTE_SEUL_FICHIER.test(path) || !added.length || !removed.length) return false
  return added.map(squelette).join('') === removed.map(squelette).join('')
}

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
 * @param {Map<string, string[]>} removed              lignes retirées, par fichier (texte seul)
 */
export function aiguiller(files, added = new Map(), tasksDef = {}, removed = new Map()) {
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

  // Fichiers où seuls des textes changent : ils n'ont rien à apprendre à V2, V3, U6, S3 ni à
  // la mutation (#456). V1, V4, V5 (signaux sur le texte ajouté), V6, U7, U1 et S2 restent.
  const texte = new Set(
    files
      .filter((f) => f.status === 'M' && texteSeul(f.path, added.get(f.path), removed.get(f.path)))
      .map((f) => f.path)
  )
  const logique = files.filter((f) => !texte.has(f.path))

  const code = has(files, CODE)
  const tests = has(logique, TEST_FILE)
  const ui = hasSrc(files, WEB_UI)
  const styles = has(files, STYLE)

  // V1 — relecteur : tout code.
  if (code.length) want('V1', `code modifié : ${list(code)}`)
  else if (files.length) want('V1', `PR sans code : relecture légère (${list(files)})`)

  // V2 — contrats.
  const contrats = hasSrc(
    logique,
    new RegExp(
      `^${JAVA}[^/]+/(web|api)/|^docs/api/openapi\\.json$|^packages/api-client/|^web/e2e/fake-backend\\.mjs$`
    )
  )
  // web/lib : tout (fiche V2) — un schéma Zod modifié ou un champ retiré ne se voit pas
  // forcément dans les lignes ajoutées (relecture #449).
  contrats.push(...hasSrc(logique, /^web\/lib\//))
  if (contrats.length) want('V2', `contrat d'API ou appel /api : ${list(contrats)}`)

  // V3 — tests : un test touché (affaiblissement ?) ou du code source (verdict mutation).
  const deleted = tests.filter((f) => f.status?.startsWith('D'))
  if (deleted.length) want('V3', `test supprimé : ${list(deleted)}`)
  else if (tests.length) want('V3', `test modifié : ${list(tests)}`)
  const src = has(
    logique,
    /^backend\/src\/main\/|^backend\/pom\.xml$|^web\/(app|components|lib)\/|^web\/[^/]+\.(ts|mjs)$|^packages\/[^/]+\/src\//
  ).filter((f) => !TEST_FILE.test(f.path))
  if (src.length) want('V3', `code source sous mutation : ${list(src)}`)

  // V4 — pédagogie.
  const pedago = hasSrc(
    files,
    new RegExp(
      `^content/(chapitres|annales|referentiel)/|^${JAVA}exercices/|^packages/content/src/|^web/components/(exercice|chapitre-interactif|quiz)`
    )
  )
  if (pedago.length) want('V4', `contenu ou évaluateur pédagogique : ${list(pedago)}`)

  // V5 — sûreté des mineurs : chemins sensibles, puis signaux dans les lignes ajoutées.
  const sensibles = hasSrc(
    files,
    new RegExp(
      `^backend/src/(main|test)/java/fr/brio/(ia|identite|social|progression)/|^backend/src/main/resources/ia/|^evals/tuteur/|` +
        `application[^/]*\\.properties$|^backend/src/main/resources/db/migration/|^web/middleware\\.ts$|` +
        `consentement|/classes?/|ma-classe|rejoindre|communaute|moderation|messagerie|entraide|salon|signalement|` +
        `/[^/]*(xp|streak|serie|progress|niveau)[^/]*\\.(tsx?|java)$`
    )
  )
  // Le harnais d'eval du tuteur vit sous src/test mais relève de V5 (fiche : backend/**/ia/**).
  sensibles.push(...has(files, /^backend\/src\/test\/java\/fr\/brio\/ia\//))
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
  const hotFiles = logique.filter((f) => {
    if (TEST_FILE.test(f.path)) return false
    // tasks.json : seulement si une ligne de tâche chaude a changé (le reste relève de U1).
    if (/^mesh\/routes\/tasks\.json$/.test(f.path))
      return (added.get(f.path) ?? []).some((l) => /"chaude":\s*true/.test(l))
    if (/^web\/(middleware\.ts|next\.config\.ts)$/.test(f.path)) return true
    const r = routeOf(f.path)
    return r !== null && touchesHot(r, /\/(layout|template|loading|error)\.tsx$/.test(f.path), hot)
  })
  if (hotFiles.length) want('U6', `route chaude ou son layout : ${list(hotFiles)}`)

  // S2 — personas : la tâche touchée, pas tout le catalogue.
  const routes = [...new Set(files.map((f) => routeOf(f.path)).filter(Boolean))]
  const taches = tasksTouched(routes, tasksDef)
  const visible = [...ui, ...hasSrc(files, /^web\/(lib\/|middleware\.ts$)/)]
  if (visible.length) {
    want(
      'S2',
      taches.length
        ? `tâches touchées : ${taches.map((t) => t.id).join(', ')}`
        : `écran modifié hors tâches clés : un seul persona sur l'écran touché (${list(visible)})`
    )
  }

  // S3 — saboteur.
  const cibles = has(
    logique,
    new RegExp(
      `^${JAVA}(identite|exercices|social)/|^web/middleware\\.ts$|form|session|exercice|communaute|connexion|mot-de-passe|messagerie|entraide|salon|signalement|chapitre-interactif`,
      'i'
    )
  ).filter((f) => !TEST_FILE.test(f.path) && !/\.md$/.test(f.path))
  if (cibles.length) want('S3', `formulaire, session, exercice ou Communauté : ${list(cibles)}`)
  for (const [re, label] of SIGNAUX.saboteur) {
    const hit = codeLines.find(({ path, l }) => !texte.has(path) && re.test(l))
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
    controles: controles(files, routes, texte),
    taches: taches.map((t) => t.id),
    nonClasses: nonClasses.map((f) => f.path),
    texteSeul: [...texte],
  }
}

export const ORDRE = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'U1', 'U6', 'U7', 'S2', 'S3']

/** Pourquoi un gardien est écarté : rien du diff dans son périmètre (rappel du périmètre). */
const PERIMETRE = {
  V1: 'diff vide',
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
export function controles(files, routes = [], texte = new Set()) {
  const any = (re) => files.some((f) => re.test(f.path))
  const anyLogique = (re) => files.some((f) => !texte.has(f.path) && re.test(f.path))
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
  // Dépendances et config racine : tout le JS peut casser (relecture #449).
  const deps = any(/^(pnpm-lock\.yaml|package\.json|turbo\.json|tsconfig[^/]*\.json)$/)
  const web = deps || any(/^web\/|^packages\//)
  out.push({
    id: 'web',
    cmd: 'pnpm --filter web test && pnpm --filter web lint',
    retenu: web,
    raison: deps
      ? 'dépendances ou config racine modifiées'
      : web
        ? 'web ou packages modifiés'
        : 'aucun fichier web ni packages',
  })
  // `pnpm --filter web test` ne lance pas les tests des paquets (racine vitest = web/).
  const pkgs = deps || any(/^packages\//)
  out.push({
    id: 'packages',
    cmd: 'pnpm --filter "./packages/*" test',
    retenu: pkgs,
    raison: pkgs ? 'packages ou dépendances modifiés' : 'aucun paquet',
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
  // Le faux backend sert content/chapitres ; next.config porte la réécriture /api des e2e.
  const e2eAll =
    deps ||
    any(
      /^web\/e2e\/(?![^/]+\.spec\.ts$)[^/]+\.(ts|mjs)$|^web\/(playwright|next)\.config\.ts$|^packages\/|^web\/middleware|^content\/chapitres\//
    ) ||
    anyLogique(/^web\/lib\//)
  const specs = files.filter((f) => /^web\/e2e\/.*\.spec\.ts$/.test(f.path)).map((f) => f.path)
  // (un helper e2e non-spec déclenche déjà la suite complète)
  // Un libellé changé dans web/lib peut casser une spec qui le cherche par son nom.
  const libelles = [...texte].some((p) => /^web\/lib\//.test(p))
  const e2e =
    e2eAll || specs.length > 0 || routes.length > 0 || any(/^web\/components\//) || libelles
  out.push({
    id: 'e2e',
    cmd: e2eAll
      ? 'pnpm --filter web exec playwright test'
      : 'pnpm --filter web exec playwright test <specs qui visitent les routes touchées>',
    retenu: e2e,
    raison: e2eAll
      ? 'faux backend, config, contenu servi, dépendances ou code partagé modifié : suite complète'
      : e2e
        ? `ciblés : specs modifiées${specs.length ? ` (${specs.join(', ')})` : ''} + celles qui visitent ${routes.join(', ') || 'les écrans touchés'}${libelles ? ' + celles qui citent les libellés modifiés (grep dans web/e2e)' : ''}`
        : 'aucun écran ni code web',
  })
  // Mutation web (Stryker, CI) : logique pure de web/lib et api-client, hors tests et hors
  // fichiers « texte seul » (muter un libellé n'apprend rien et coûte des heures, #456).
  const aMuter = files
    .filter(
      (f) =>
        !f.status?.startsWith('D') &&
        !texte.has(f.path) &&
        /^(web\/lib|packages\/api-client\/src)\/.*\.ts$/.test(f.path) &&
        !/(__tests__\/|\.test\.ts$|\/generated\/)/.test(f.path)
    )
    .map((f) => f.path)
  out.push({
    id: 'mutation-web',
    cmd: `web/node_modules/.bin/stryker run mesh/mutation/stryker.web.config.mjs --mutate "${aMuter.join(',')}"`,
    retenu: aMuter.length > 0,
    raison: aMuter.length
      ? `logique web modifiée : ${aMuter.join(', ')}`
      : texte.size
        ? 'seuls des textes changent dans web/lib : rien à muter'
        : 'aucune logique web/lib ni api-client',
    fichiers: aMuter,
  })
  return out
}

/** Lignes retirées par fichier, depuis un diff unifié (fichier = chemin « +++ b/ »). */
export function removedLines(patch) {
  const map = new Map()
  let cur = null
  for (const line of patch.split('\n')) {
    const h = /^\+\+\+ (?:b\/)?(.+)$/.exec(line)
    if (h) {
      cur = h[1] === '/dev/null' ? null : h[1]
      if (cur && !map.has(cur)) map.set(cur, [])
      continue
    }
    if (line.startsWith('--- ') || line.startsWith('diff --git')) continue
    if (cur && line.startsWith('-')) map.get(cur).push(line.slice(1))
  }
  return map
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
  if (result.texteSeul?.length)
    out.push('', `✏️ Texte seul (libellés, commentaires) : ${result.texteSeul.join(', ')}`)
  if (result.nonClasses.length)
    out.push('', `⚠️ Non classés (relus par V1) : ${result.nonClasses.join(', ')}`)
  return out.join('\n')
}
