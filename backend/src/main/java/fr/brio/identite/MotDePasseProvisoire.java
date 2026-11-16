package fr.brio.identite;

import java.security.SecureRandom;

/**
 * Provisional password of a teacher-led access reset (ADR 0036 §2): 12 characters drawn from a
 * CSPRNG, in three groups of four joined by dashes ({@code k7m4-p9xa-3rtw}). The alphabet is the
 * login identifier's — lower case, without the characters a child confuses (0/o, 1/l/i) — and the
 * dashes are part of the password, so the student types exactly what they are shown.
 */
final class MotDePasseProvisoire {

    static final String ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
    private static final int GROUPES = 3;
    private static final int TAILLE_GROUPE = 4;
    private static final SecureRandom RNG = new SecureRandom();

    private MotDePasseProvisoire() {}

    static String generer() {
        var sb = new StringBuilder(GROUPES * (TAILLE_GROUPE + 1));
        for (int g = 0; g < GROUPES; g++) {
            if (g > 0) sb.append('-');
            for (int i = 0; i < TAILLE_GROUPE; i++) {
                sb.append(ALPHABET.charAt(RNG.nextInt(ALPHABET.length())));
            }
        }
        return sb.toString();
    }
}
