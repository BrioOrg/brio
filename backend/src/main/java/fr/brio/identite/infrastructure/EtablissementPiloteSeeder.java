package fr.brio.identite.infrastructure;

import fr.brio.identite.domain.Etablissement;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creates one fictional établissement, with a fictional convention, when the environment
 * names it ({@code brio.etablissement-pilote.nom}). It is what lets teachers of the private
 * environment pick an établissement and hand a working class code to a student without an
 * administrator (ADR 0029 §5).
 *
 * <p>The convention gate itself is untouched (ADR 0018 §3): a production environment leaves
 * the setting empty, nothing is created, and an établissement only ever gets a convention
 * from an administrator. Idempotent — the fictional convention reference marks the row.
 */
@Component
class EtablissementPiloteSeeder implements ApplicationRunner {

    /** Never a real convention: recognisable in the data and in an audit. */
    static final String CONVENTION_FICTIVE = "PILOTE-FICTIF";

    private static final Logger log = LoggerFactory.getLogger(EtablissementPiloteSeeder.class);

    private final EtablissementRepository etablissements;
    private final String nom;
    private final String type;

    EtablissementPiloteSeeder(EtablissementRepository etablissements,
                              @Value("${brio.etablissement-pilote.nom:}") String nom,
                              @Value("${brio.etablissement-pilote.type:college}") String type) {
        this.etablissements = etablissements;
        this.nom = nom;
        this.type = type;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (nom == null || nom.isBlank() || etablissements.existsByConventionReference(CONVENTION_FICTIVE)) {
            return;
        }
        etablissements.save(Etablissement.creer(nom.trim(), null, type, LocalDate.now(), CONVENTION_FICTIVE));
        log.warn("Seeded fictional établissement '{}' with a fictional convention — "
                + "never set brio.etablissement-pilote.nom on an environment holding real data", nom.trim());
    }
}
