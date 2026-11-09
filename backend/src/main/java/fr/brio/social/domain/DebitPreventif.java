package fr.brio.social.domain;

import fr.brio.social.TropDeMessagesException;
import java.time.Duration;

/**
 * Shared preventive rate-limit for every social write surface (ADR 0023). Takes a count already
 * gathered by the caller rather than a repository, so it fits surfaces that span several tables
 * (the Communauté counts questions + answers of the same author). Pure and side-effect free.
 */
public final class DebitPreventif {

    /** Rate-limit window shared by every social write surface. */
    public static final Duration FENETRE = Duration.ofMinutes(1);

    /**
     * Max author writes per window. Mirrors entraide/messagerie (ADR 0023). 5 is defensible:
     * a real asker posts a question plus a few answers, not 6 in a single minute.
     */
    public static final int MAX_PAR_FENETRE = 5;

    private DebitPreventif() {}

    /** Throws {@link TropDeMessagesException} when the author already wrote the window's quota. */
    public static void exiger(long ecritsRecentsDeLAuteur) {
        if (ecritsRecentsDeLAuteur >= MAX_PAR_FENETRE) {
            throw new TropDeMessagesException("Vous écrivez trop vite. Patientez un instant.");
        }
    }
}
