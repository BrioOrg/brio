package fr.brio.identite.infrastructure;

import fr.brio.identite.api.AvisReinitialisation;
import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.RoleCompte;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/** Builds the client projection of a compte, including the student's displayed level (#325). */
@Component
public class CompteInfoAssembler {

    /**
     * How long after a reset the student is still told about it (ADR 0036 §8). The notice is only
     * closed on the device that closes it, never on the server: an adult who chose the password in
     * the student's place cannot hide it from the student's own device within this window.
     */
    static final Duration HORIZON_AVIS = Duration.ofDays(30);

    private final InscriptionRepository inscriptions;

    CompteInfoAssembler(InscriptionRepository inscriptions) {
        this.inscriptions = inscriptions;
    }

    public CompteInfo pour(Compte compte) {
        return new CompteInfo(
                compte.getId(),
                compte.getRole().name(),
                compte.getStatut().name(),
                compte.getNom(),
                compte.getEmail(),
                // Withheld until the student chose their own password (ADR 0036 §9).
                compte.isDoitChangerMotDePasse() ? null : compte.getPseudonyme(),
                niveau(compte),
                compte.isDoitChangerMotDePasse(),
                avis(compte));
    }

    /** The last reset, once the change is done and within {@link #HORIZON_AVIS}; else null. */
    private static AvisReinitialisation avis(Compte compte) {
        Instant le = compte.getAccesReinitialiseLe();
        if (compte.isDoitChangerMotDePasse() || le == null
                || Instant.now().isAfter(le.plus(HORIZON_AVIS))) {
            return null;
        }
        return new AvisReinitialisation(le, compte.getAccesReinitialisePar());
    }

    /** The active class's level; a student in no class falls back on the level they declared. */
    private String niveau(Compte compte) {
        if (compte.getRole() != RoleCompte.eleve) {
            return null;
        }
        return inscriptions.niveauxDesClassesActives(compte.getId()).stream()
                .findFirst()
                .orElse(compte.getNiveauDeclare());
    }
}
