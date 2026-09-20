package fr.brio.progression.api;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * A chapter's state on a student's path (ADR 0022, issue #94), derived server-side
 * from real completion data — never fabricated (règle mineurs). Serialised as its
 * lowercase code so the contract is stable regardless of the enum name.
 */
public enum EtatParcours {
    /** All sections read and ≥ 80 % of exercises solved. */
    FAIT("fait"),
    /** Unlocked (first, or previous chapter done) and not yet complete — the active node. */
    EN_COURS("en_cours"),
    /** A previous chapter is not done — not yet reachable. */
    VERROUILLE("verrouille");

    private final String code;

    EtatParcours(String code) {
        this.code = code;
    }

    @JsonValue
    public String code() {
        return code;
    }
}
