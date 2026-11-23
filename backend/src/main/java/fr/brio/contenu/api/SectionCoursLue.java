package fr.brio.contenu.api;

import java.time.Instant;
import java.util.UUID;

/**
 * Published when a student marks a section of a teacher course as read (ADR 0050 §1). Emitted by
 * contenu from {@code POST /api/cours/{coursId}/sections/{sectionId}/lu} only after the course was
 * checked visible to the student (same rule as reading the course) and the section found in its
 * currently published version. Distinct from {@link SectionTerminee}, which stays chapter-only.
 */
public record SectionCoursLue(UUID eleveId, UUID coursId, String sectionId, Instant survenuLe) {}
