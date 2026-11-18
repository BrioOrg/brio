// Stryker (mutation testing) for the web — mesh Phase 3, #358. Skeleton, to validate on the first run.
//
// Run from web/ (Vitest runner), on the CHANGED files only:
//   cd web && pnpm dlx --package @stryker-mutator/core@9.4.0 --package @stryker-mutator/vitest-runner@9.4.0 \
//     stryker run ../mesh/mutation/stryker.web.config.mjs --mutate "lib/progression.ts,lib/echeance.ts"
// Why `dlx` and not a devDependency: adding a library changes pnpm-lock.yaml and needs a rationale
// (CLAUDE.md « Don't introduce a new library without a short rationale »). Once validated, the
// human may promote it to devDependencies in its own PR (docs/mesh/VERIFICATION.md §Mutation).
//
// Scope: pure logic under web/lib and packages/api-client. Components and pages are excluded: their
// value is covered by Playwright, and mutating JSX with jsdom is slow and noisy.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: { configFile: 'vitest.config.ts' },
  // Default scope when --mutate is not given. The workflow always passes the changed files.
  mutate: ['lib/**/*.ts', '!lib/**/__tests__/**', '!lib/**/*.test.ts', '../packages/api-client/src/**/*.ts', '!../packages/api-client/src/generated/**'],
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
