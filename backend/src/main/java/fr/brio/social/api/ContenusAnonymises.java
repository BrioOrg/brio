package fr.brio.social.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Published by the social retention purge (ADR 0023 §6) when contents that earned XP are
 * anonymised.
 *
 * <p>{@code progression} keeps, for each answer marked useful, an XP event whose {@code
 * source_ref} is the answer's id next to the student's id — a join that would give the author
 * back. On this event it cuts that reference, so the anonymisation holds across modules.
 *
 * <p>Published on every run, even with no id: {@code seuil} lets {@code progression} also cut,
 * as a backstop, any entraide XP itself older than the window — a content is always older than
 * the XP it earned, so that is always safe, and it covers a delivery that failed.
 *
 * <p>Carries content ids only, never an author id.
 *
 * @param contenuIds ids of the anonymised entraide messages and Communauté answers that were
 *     marked useful (the only contents that can carry an XP reference)
 * @param seuil the run's threshold: contents created before it are anonymised
 */
public record ContenusAnonymises(List<UUID> contenuIds, Instant seuil) {

    public ContenusAnonymises {
        contenuIds = List.copyOf(contenuIds);
    }
}
