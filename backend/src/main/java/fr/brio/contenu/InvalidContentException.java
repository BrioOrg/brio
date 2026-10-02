package fr.brio.contenu;

import java.util.List;

/**
 * A document that cannot be ingested or published. The message is for logs and ingestion
 * output; {@link #violations()} carries the same failures in a form the editor can translate
 * and locate (empty when the failure has no meaning for a teacher, e.g. an unknown niveau).
 */
public class InvalidContentException extends RuntimeException {

    private final List<ContentViolation> violations;

    public InvalidContentException(String message) {
        this(message, List.of());
    }

    public InvalidContentException(String message, List<ContentViolation> violations) {
        super(message);
        this.violations = List.copyOf(violations);
    }

    public InvalidContentException(String message, ContentViolation violation) {
        this(message, List.of(violation));
    }

    public List<ContentViolation> violations() {
        return violations;
    }
}
