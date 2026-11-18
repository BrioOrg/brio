package fr.brio.identite;

import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * The application's password encoder: the delegate (Spring's {@code DelegatingPasswordEncoder},
 * bcrypt) for every password, plus the tolerance owed to a provisional password (ADR 0036 §2).
 * When the stored hash bears {@link MotDePasseProvisoire#PREFIXE}, the typed password is
 * canonicalised (dashes, spaces and case dropped) before the delegate compares it; any other hash
 * is compared exactly as before. The hashing itself stays the delegate's.
 */
public final class EncodeurMotsDePasse implements PasswordEncoder {

    private final PasswordEncoder delegue;

    public EncodeurMotsDePasse(PasswordEncoder delegue) {
        this.delegue = delegue;
    }

    @Override
    public String encode(CharSequence motDePasse) {
        return delegue.encode(motDePasse);
    }

    @Override
    public boolean matches(CharSequence saisi, String hash) {
        if (hash != null && hash.startsWith(MotDePasseProvisoire.PREFIXE)) {
            return delegue.matches(MotDePasseProvisoire.normaliser(saisi),
                    hash.substring(MotDePasseProvisoire.PREFIXE.length()));
        }
        return delegue.matches(saisi, hash);
    }

    @Override
    public boolean upgradeEncoding(String hash) {
        // Never re-hash a provisional password with the typed (non-canonical) form.
        if (hash != null && hash.startsWith(MotDePasseProvisoire.PREFIXE)) return false;
        return delegue.upgradeEncoding(hash);
    }
}
