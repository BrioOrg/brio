package fr.brio.identite;

import java.util.Locale;

/**
 * The tolerant reading of a typed login identifier (ADR 0036 §2, #364). A teacher reads the
 * identifier out or copies it grouped by four ({@code k7m4 p9xa 3r}); a phone keyboard adds a
 * capital. Every stored identifier is lower case without any space — generated ones
 * ({@code IdentifiantGenerator}: 10 characters of a lower-case alphabet), a teacher's (their
 * e-mail, trimmed and lower-cased at signup) and the local seeds — so dropping spaces and case
 * from what was typed can only ever match the one account whose identifier it already is.
 */
public final class IdentifiantConnexion {

    private IdentifiantConnexion() {}

    /**
     * What was typed, without any space (inner ones and non-breaking ones included) and in lower
     * case; null when nothing is left.
     */
    public static String normaliser(String saisi) {
        if (saisi == null) return null;
        var sb = new StringBuilder(saisi.length());
        for (int i = 0; i < saisi.length(); i++) {
            char c = saisi.charAt(i);
            if (!estEspace(c)) sb.append(c);
        }
        String t = sb.toString().toLowerCase(Locale.ROOT);
        return t.isEmpty() ? null : t;
    }

    /** Any space a keyboard or a copy can produce, the non-breaking ones (U+00A0, U+202F) too. */
    public static boolean estEspace(char c) {
        return Character.isWhitespace(c) || Character.isSpaceChar(c);
    }
}
