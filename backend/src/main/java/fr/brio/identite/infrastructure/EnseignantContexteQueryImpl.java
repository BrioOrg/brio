package fr.brio.identite.infrastructure;

import fr.brio.identite.api.EnseignantContexteQuery;
import fr.brio.identite.domain.Classe;
import fr.brio.identite.domain.StatutClasse;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class EnseignantContexteQueryImpl implements EnseignantContexteQuery {

    private final ClasseRepository classes;

    EnseignantContexteQueryImpl(ClasseRepository classes) {
        this.classes = classes;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> classesEnseignees(UUID compteId) {
        return classesActives(compteId).stream().map(Classe::getId).collect(Collectors.toSet());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<UUID> etablissementDeLEnseignant(UUID compteId) {
        Set<UUID> etablissements = classesActives(compteId).stream()
                .map(Classe::getEtablissementId)
                .collect(Collectors.toSet());
        // Exactly one établissement is unambiguous; zero or several are not.
        return etablissements.size() == 1 ? Optional.of(etablissements.iterator().next()) : Optional.empty();
    }

    private java.util.List<Classe> classesActives(UUID compteId) {
        return classes.findByEnseignantPrincipalId(compteId).stream()
                .filter(c -> c.getStatut() == StatutClasse.active)
                .toList();
    }
}
