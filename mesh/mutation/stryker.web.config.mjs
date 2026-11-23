// Stryker (mutation testing) for the web — mesh Phase 3, #358; made to actually run in #372.
//
// Run from the REPO ROOT (not web/), on the CHANGED files only:
//   web/node_modules/.bin/stryker run mesh/mutation/stryker.web.config.mjs \
//     --mutate "web/lib/progression.ts,packages/api-client/src/session.ts"
// Stryker and its Vitest runner are devDependencies of web/, so they drive the repo's own Vitest
// (2.x). `pnpm dlx` fetched the latest Vitest instead, which cannot run this suite (#372).
//
// Why the root and `inPlace`: packages/api-client has no tests of its own; web's Vitest covers it
// through the `@brio/api-client` alias (`../packages/...`). Started from web/, Stryker sees no file
// outside web/ (0 mutant for api-client), and its sandbox copy of web/ breaks that alias. From the
// root, in place, both web/lib and api-client are in the project and the alias resolves as usual.
// In place means Stryker edits the checkout while it runs and restores it at the end: run it on a
// clean tree.
//
// Scope: pure logic under web/lib and packages/api-client. Components and pages are excluded: their
// value is covered by Playwright, and mutating JSX with jsdom is slow and noisy.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  // `related: false`: from the root, Vitest cannot map mutated files back to their tests. The dry
  // run takes the whole web suite once; `perTest` coverage then narrows each mutant to its tests.
  vitest: { configFile: 'web/vitest.config.ts', dir: 'web', related: false },
  inPlace: true,
  // The project is web/ and packages/ only. In place, Stryker rewrites the files it reads and drops
  // their executable bit (scripts/**/*.mjs); everything else stays on disk for the tests anyway.
  ignorePatterns: ['/*', '!/web', '!/packages', '!/package.json', '!/pnpm-workspace.yaml'],
  // Default scope when --mutate is not given. The workflow always passes the changed files.
  mutate: [
    'web/lib/**/*.ts',
    '!web/lib/**/__tests__/**',
    '!web/lib/**/*.test.ts',
    'packages/api-client/src/**/*.ts',
    '!packages/api-client/src/generated/**',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'json', 'html'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  // `break` is the hard floor of Stryker itself; the verdict (mutation-to-verdict.mjs) applies
  // mesh/verification/config.json, which is the human-owned source of truth for the threshold.
  thresholds: { high: 80, low: 60, break: null },
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  timeoutMS: 10000,
  concurrency: 2,
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
}
