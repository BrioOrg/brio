package fr.brio.identite.infrastructure;

import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.domain.Classe;
import fr.brio.identite.domain.Compte;
import fr.brio.identite.domain.RoleCompte;
import fr.brio.identite.domain.StatutClasse;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class EnseignantContexteQueryImpl implements EnseignantContexteQuery {

    private final ClasseRepository classes;
    private final CompteRepository comptes;
    private final RattachementRepository rattachements;

    EnseignantContexteQueryImpl(ClasseRepository classes, CompteRepository comptes,
                                RattachementRepository rattachements) {
        this.classes = classes;
        this.comptes = comptes;
        this.rattachements = rattachements;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> classesEnseignees(UUID compteId) {
        return classesActives(compteId).stream().map(Classe::getId).collect(Collectors.toSet());
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> etablissementsDeLEnseignant(UUID compteId) {
        return rattachements.findByIdCompteId(compteId).stream()
                .map(r -> r.getId().etablissementId())
                .collect(Collectors.toSet());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, String> nomsDesEnseignants(Set<UUID> compteIds) {
        if (compteIds.isEmpty()) {
            return Map.of();
        }
        return comptes.findAllById(compteIds).stream()
                .filter(c -> c.getRole() == RoleCompte.enseignant)
                .filter(c -> c.getNom() != null && !c.getNom().isBlank())
                .collect(Collectors.toMap(Compte::getId, Compte::getNom));
    }

    private java.util.List<Classe> classesActives(UUID compteId) {
        return classes.findByEnseignantPrincipalId(compteId).stream()
                .filter(c -> c.getStatut() == StatutClasse.active)
                .toList();
    }
}
