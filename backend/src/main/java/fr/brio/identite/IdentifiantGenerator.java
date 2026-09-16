package fr.brio.identite;

import fr.brio.identite.infrastructure.CompteRepository;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

@Component
class IdentifiantGenerator {

    // Lowercase unambiguous alphabet: excludes 0/1/O/I — legible off a whiteboard (ADR 0018 §5)
    private static final String ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
    private static final int LENGTH = 10;

    private final CompteRepository comptes;

    IdentifiantGenerator(CompteRepository comptes) {
        this.comptes = comptes;
    }

    String generateUnique() {
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = generate();
            if (comptes.findByIdentifiantConnexion(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new IllegalStateException("Impossible de générer un identifiant unique après 5 tentatives");
    }

    private static String generate() {
        var rng = new SecureRandom();
        var sb = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(ALPHABET.charAt(rng.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
