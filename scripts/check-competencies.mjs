#!/usr/bin/env node
/**
 * Checks that every competency code referenced by content is defined in the
 * referential (content/referentiel/*.json), and that the referential itself is
 * well-formed (code grammar, uniqueness, cycle/domaine coherence — the checks
 * JSON Schema cannot express; full schema validation happens at ingestion).
 *
 * Scanned for references: chapter files under content/ (excluding the
 * referential itself) and docs/schema/examples/.
 *
 * Zero dependencies; exits non-zero on any problem. See ADR 0009.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;

const CODE_PATTERN =
  /^c[34]\.(num|geo|gm|ogd|algo)\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DOMAIN_BY_ABBREV = {
  num: "nombres-et-calculs",
  geo: "espace-et-geometrie",
  gm: "grandeurs-et-mesures",
  ogd: "organisation-et-gestion-de-donnees-fonctions",
  algo: "algorithmique-et-programmation",
};

const errors = [];

function fail(file, message) {
  errors.push(`${relative(repoRoot, file)}: ${message}`);
}

function jsonFilesUnder(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true, recursive: true });
  } catch {
    return []; // directory absent — nothing to scan
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".json"))
    .map((e) => join(e.parentPath, e.name));
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    fail(file, `invalid JSON: ${e.message}`);
    return null;
  }
}

// --- 1. Load and check the referential -------------------------------------

const referentialFiles = jsonFilesUnder(join(repoRoot, "content/referentiel"));
if (referentialFiles.length === 0) {
  console.error("✗ No referential file found under content/referentiel/");
  process.exit(1);
}

const knownCodes = new Set();
const deprecatedCodes = new Set();

// Map: niveau → Set of programme values seen on non-deprecated entries (for invariant check).
const programmeByNiveau = {};

for (const file of referentialFiles) {
  const doc = readJson(file);
  if (!doc) continue;
  if (!Array.isArray(doc.competences)) {
    fail(file, "missing 'competences' array");
    continue;
  }
  for (const entry of doc.competences) {
    const code = entry?.code;
    if (typeof code !== "string" || !CODE_PATTERN.test(code)) {
      fail(file, `malformed code: ${JSON.stringify(code)}`);
      continue;
    }
    if (knownCodes.has(code) || deprecatedCodes.has(code)) {
      fail(file, `duplicate code: ${code}`);
      continue;
    }

    const isDeprecated = typeof entry.deprecatedSince === "string";
    if (isDeprecated) {
      deprecatedCodes.add(code);
    } else {
      knownCodes.add(code);
    }

    const [cyclePart, domainAbbrev] = code.split(".");
    if (entry.cycle !== Number(cyclePart.slice(1))) {
      fail(file, `${code}: cycle ${entry.cycle} contradicts code prefix ${cyclePart}`);
    }
    if (entry.domaine !== DOMAIN_BY_ABBREV[domainAbbrev]) {
      fail(
        file,
        `${code}: domaine '${entry.domaine}' contradicts code segment '${domainAbbrev}' (expected '${DOMAIN_BY_ABBREV[domainAbbrev]}')`,
      );
    }

    if (!isDeprecated) {
      if (typeof entry.programme !== "string") {
        fail(file, `${code}: non-deprecated entry is missing 'programme' field`);
      } else {
        for (const niveau of (entry.niveaux ?? [])) {
          if (!programmeByNiveau[niveau]) programmeByNiveau[niveau] = new Set();
          programmeByNiveau[niveau].add(entry.programme);
        }
      }
    }
  }
}

// Invariant: for each niveau, all non-deprecated entries must share one programme value.
for (const [niveau, programmes] of Object.entries(programmeByNiveau)) {
  if (programmes.size > 1) {
    errors.push(
      `Referential invariant violated: niveau '${niveau}' has entries from multiple programmes (${[...programmes].join(", ")}). ` +
      "Each niveau must belong to exactly one non-deprecated programme.",
    );
  }
}

// --- 2. Scan content for competency references ------------------------------

function collectReferences(node, refs) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectReferences(item, refs));
  } else if (node && typeof node === "object") {
    if (Array.isArray(node.competencies)) {
      node.competencies.forEach((c) => refs.push(c));
    }
    Object.values(node).forEach((v) => collectReferences(v, refs));
  }
}

const chapterFiles = [
  ...jsonFilesUnder(join(repoRoot, "content")).filter(
    (f) => !f.includes("/referentiel/"),
  ),
  ...jsonFilesUnder(join(repoRoot, "docs/schema/examples")),
];

let referenceCount = 0;
for (const file of chapterFiles) {
  const doc = readJson(file);
  if (!doc) continue;
  const refs = [];
  collectReferences(doc, refs);
  referenceCount += refs.length;
  for (const code of refs) {
    if (deprecatedCodes.has(code)) {
      fail(file, `deprecated competency code: ${code} — content must reference only non-deprecated codes`);
    } else if (!knownCodes.has(code)) {
      fail(file, `unknown competency code: ${code}`);
    }
  }
}

// --- 3. Report --------------------------------------------------------------

if (errors.length > 0) {
  console.error(`✗ Competency check failed (${errors.length} problem(s)):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `✓ ${knownCodes.size} active competency codes (${deprecatedCodes.size} deprecated); ` +
  `${referenceCount} reference(s) in ${chapterFiles.length} content file(s) — all resolved.`,
);
