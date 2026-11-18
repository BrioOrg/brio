package fr.brio.identite;

import java.security.SecureRandom;
import java.util.Locale;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Provisional password of a teacher-led access reset (ADR 0036 §2): 12 characters drawn from a
 * CSPRNG, in three groups of four joined by dashes ({@code k7m4-p9xa-3rtw}). The alphabet is the
 * login identifier's — lower case, without the characters a child confuses (0/o, 1/l/i).
 *
 * <p>The student may type it without the dashes, with spaces, or in capitals (ADR 0036 §2): it is
 * hashed in a canonical form, and its hash carries the {@link #PREFIXE} marker that tells
 * {@link EncodeurMotsDePasse} to canonicalise the typed password the same way before comparing.
 * Only a provisional hash bears the marker, so an account's own password stays exact.
 */
public final class MotDePasseProvisoire {

    /** Marks a provisional password's hash, ahead of the encoder's own {@code {bcrypt}} prefix. */
    public static final String PREFIXE = "{provisoire}";

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

    /**
     * The canonical form both hashed and compared: no dashes, no spaces — non-breaking ones
     * (U+00A0, U+202F) included, which a copy from a French page can bring — lower case.
     */
    static String normaliser(CharSequence saisi) {
        if (saisi == null) return null;
        var sb = new StringBuilder(saisi.length());
        for (int i = 0; i < saisi.length(); i++) {
            char c = saisi.charAt(i);
            if (c != '-' && !IdentifiantConnexion.estEspace(c)) sb.append(c);
        }
        return sb.toString().toLowerCase(Locale.ROOT);
    }

    /** The stored hash of a provisional password: the marker, then the encoder's hash of its canonical form. */
    static String hacher(PasswordEncoder encodeur, String provisoire) {
        return PREFIXE + encodeur.encode(normaliser(provisoire));
    }
}
