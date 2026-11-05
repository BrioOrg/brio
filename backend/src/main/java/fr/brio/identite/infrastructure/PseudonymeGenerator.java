package fr.brio.identite.infrastructure;

import java.security.SecureRandom;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Assigns a student's out-of-class identity, "Animal-Couleur" (#325, ADR 0016 §2). Reviewed
 * word lists: animals with no common insult or mockery attached (no Blaireau, Pigeon, Phoque,
 * Dinde…), and colours that are invariable nouns, so nothing needs agreeing with the animal
 * and no colour refers to skin. The V40 backfill holds a frozen copy of these lists.
 */
@Component
public class PseudonymeGenerator {

    static final List<String> ANIMAUX = List.of(
            "Renard", "Loup", "Lynx", "Ours", "Cerf", "Chamois", "Bouquetin", "Écureuil",
            "Hérisson", "Loutre", "Hermine", "Marmotte", "Fennec", "Suricate", "Panda", "Koala",
            "Tigre", "Lion", "Léopard", "Guépard", "Jaguar", "Puma", "Bison", "Dauphin",
            "Orque", "Otarie", "Faucon", "Aigle", "Hibou", "Chouette", "Héron", "Cygne",
            "Colibri", "Mésange", "Pinson", "Albatros", "Libellule", "Coccinelle", "Papillon", "Salamandre");

    static final List<String> COULEURS = List.of(
            "Turquoise", "Indigo", "Émeraude", "Ambre", "Corail", "Saphir", "Azur", "Cobalt",
            "Ocre", "Lilas", "Menthe", "Citron", "Cerise", "Prune", "Pervenche", "Safran",
            "Orange", "Sable", "Olive", "Cuivre");

    private final SecureRandom rng = new SecureRandom();
    private final CompteRepository comptes;

    PseudonymeGenerator(CompteRepository comptes) {
        this.comptes = comptes;
    }

    /** A free pseudonym: a random pair, with a numeric suffix if that pair is already taken. */
    public String generateUnique() {
        String base = ANIMAUX.get(rng.nextInt(ANIMAUX.size()))
                + "-" + COULEURS.get(rng.nextInt(COULEURS.size()));
        String candidat = base;
        for (int suffixe = 2; comptes.existsByPseudonyme(candidat); suffixe++) {
            candidat = base + "-" + suffixe;
        }
        return candidat;
    }
}
