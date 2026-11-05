package fr.brio.identite.infrastructure;

import fr.brio.identite.api.CompteInfo;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.RoleCompte;
import org.springframework.stereotype.Component;

/** Builds the client projection of a compte, including the student's displayed level (#325). */
@Component
public class CompteInfoAssembler {

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
                compte.getPseudonyme(),
                niveau(compte));
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
