package fr.brio.contenu.api;

import java.util.UUID;

/** Outcome of publishing a course: the immutable version that was frozen (ADR 0019). */
public record PublicationResult(UUID coursId, int version) {
}
