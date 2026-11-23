package fr.brio.progression.api;

import java.util.UUID;

/**
 * The authenticated student's gauge for one teacher course (ADR 0050 §5): the percentage, the
 * sticky completion and the sections read out of the sections of the published version.
 */
public record ProgressionCoursInfo(UUID coursId, int pourcentage, boolean termine, int sectionsLues, int sectionsTotal) {}
