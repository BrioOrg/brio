package fr.brio.contenu;

/**
 * One reason a document cannot be published, located precisely enough for the editor to lead
 * the teacher to it. {@code code} is a stable identifier the web client translates; the
 * locators are null when the violation is not attached to a section, a block or a field.
 *
 * @param code      stable machine-readable reason (see the constants below)
 * @param sectionId id of the section holding the faulty block, or of the faulty section
 * @param blockId   id of the faulty block
 * @param field     path of the faulty field relative to the block (or section, or document),
 *                  e.g. {@code text}, {@code choices[0].text}, {@code target}
 */
public record ContentViolation(String code, String sectionId, String blockId, String field) {

    /** A required field is absent. */
    public static final String REQUIRED = "REQUIRED";
    /** A field is present but empty (empty string, too few items). */
    public static final String EMPTY = "EMPTY";
    /** A field has the wrong shape (pattern, type, enum, unexpected property…). */
    public static final String INVALID_FORMAT = "INVALID_FORMAT";
    public static final String MISSING_ALT = "MISSING_ALT";
    public static final String BLANK_COUNT_MISMATCH = "BLANK_COUNT_MISMATCH";
    public static final String ANSWER_NOT_IN_BANK = "ANSWER_NOT_IN_BANK";
    public static final String REFERENCE_CHAPTER_NOT_FOUND = "REFERENCE_CHAPTER_NOT_FOUND";
    public static final String REFERENCE_ANCHOR_NOT_FOUND = "REFERENCE_ANCHOR_NOT_FOUND";
    public static final String UNKNOWN_COMPETENCY = "UNKNOWN_COMPETENCY";
    public static final String DEPRECATED_COMPETENCY = "DEPRECATED_COMPETENCY";
    public static final String EMPTY_COURSE = "EMPTY_COURSE";
}
