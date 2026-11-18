package fr.brio.social.api;

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
 * <p>Carries content ids only, never an author id.
 *
 * @param contenuIds ids of the anonymised entraide messages and Communauté answers that were
 *     marked useful (the only contents that can carry an XP reference)
 */
public record ContenusAnonymises(List<UUID> contenuIds) {

    public ContenusAnonymises {
        contenuIds = List.copyOf(contenuIds);
    }
}
