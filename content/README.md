# Content

Git is the editorial source of truth (ADR 0008). PostgreSQL is a re-derivable projection of what is here.

## Directory layout

```
content/
  chapitres/
    <niveau>/
      <matiere>/
        _index.json              # ordered list of slugs for this subject/level
        <slug>.json              # one chapter file
  referentiel/
    mathematiques-college.json   # competency referential (loaded at startup)
```

## Ingestion

The `ingest` Spring profile runs the ingestion command:

```bash
# From the backend/ directory:
./mvnw spring-boot:run \
  -Dspring-boot.run.profiles=ingest \
  -Dspring-boot.run.arguments="../content"
```

Or from a packaged JAR:

```bash
java -jar app.jar ../content --spring.profiles.active=ingest
```

The command exits 0 if all chapters succeed, 1 if any chapter fails. A per-chapter
summary (CREATED / UPDATED / SKIPPED / FAILED) is printed to the log.

### Local development

With `--spring.profiles.active=local`, the app seeds the database automatically on startup
from `../content` (relative to `backend/`). Override with `--brio.content.dir=<path>`.

## Idempotency (ADR 0010)

Two consecutive runs on the same content produce identical database state:

- **Skip**: a chapter whose `content_hash` matches the stored hash is not written.
- **Update**: a changed chapter is upserted; exercise UUIDs are preserved by
  `(chapitre_id, slug)` so existing submissions remain valid.
- **Retire**: exercises removed from a chapter file get `retired_at` set; they are
  never deleted and submissions to them remain intact.

### INGEST_VERSION

The hash is `SHA-256(canonical_json + INGEST_VERSION)`. When the ingestion
transformation logic changes (e.g., a new field is stripped or a new column derived),
increment `INGEST_VERSION` in `ChapitreIngestionTx.java`. All chapters will be
re-ingested on the next run.

## Chapter file format

Files conform to `backend/src/main/resources/contenu/course-content.schema.json`.

The optional `status` field controls visibility:

```json
{ "status": "draft" }   // hidden from the catalogue
{ "status": "published" } // visible (default when absent)
```

## Ordering

The `_index.json` file for each `<niveau>/<matiere>` pair is a JSON array of slugs
in display order. The ingestion command uses the position in this array to set the
`ordre` column.

## Competency codes

Competency codes in chapter files must exist in `referentiel/mathematiques-college.json`.
The ingestion command validates this and rejects the chapter if any code is unknown.
See ADR 0009 for the code format.
