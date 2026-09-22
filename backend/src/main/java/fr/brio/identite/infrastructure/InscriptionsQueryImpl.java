package fr.brio.identite.infrastructure;

import fr.brio.identite.api.InscriptionsQuery;
import fr.brio.identite.domain.Inscription;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class InscriptionsQueryImpl implements InscriptionsQuery {

    private final InscriptionRepository inscriptions;

    InscriptionsQueryImpl(InscriptionRepository inscriptions) {
        this.inscriptions = inscriptions;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<UUID> classesDeLEleve(UUID compteId) {
        return inscriptions.findByIdCompteId(compteId).stream()
                .filter(i -> "eleve".equals(i.getRoleDansClasse()))
                .map(i -> i.getId().classeId())
                .collect(Collectors.toSet());
    }
}
