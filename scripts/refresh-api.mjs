#!/usr/bin/env node
// Fetches the live OpenAPI spec and writes it to docs/api/openapi.json.
// Requires a running backend. Usage: pnpm api:refresh
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:8080'
const url = `${baseUrl}/v3/api-docs`

const res = await fetch(url)
if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`)

const spec = await res.json()

function sortDeep(val) {
  if (Array.isArray(val)) return val.map(sortDeep)
  if (val !== null && typeof val === 'object') {
    return Object.fromEntries(Object.keys(val).sort().map((k) => [k, sortDeep(val[k])]))
  }
  return val
}

const repoRoot = new URL('..', import.meta.url).pathname
const outPath = join(repoRoot, 'docs', 'api', 'openapi.json')
mkdirSync(join(repoRoot, 'docs', 'api'), { recursive: true })
writeFileSync(outPath, JSON.stringify(sortDeep(spec), null, 2) + '\n')
console.log(`Written to docs/api/openapi.json`)
console.log(`Next: pnpm build (regenerates the TypeScript client)`)
