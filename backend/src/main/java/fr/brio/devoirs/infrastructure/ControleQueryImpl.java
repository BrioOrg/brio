package fr.brio.devoirs.infrastructure;

import fr.brio.devoirs.DevoirService;
import fr.brio.devoirs.api.ControleQuery;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Adapte le port {@code api} ControleQuery sur la logique du service (ADR 0025). */
@Component
class ControleQueryImpl implements ControleQuery {

    private final DevoirService devoirs;

    ControleQueryImpl(DevoirService devoirs) {
        this.devoirs = devoirs;
    }

    @Override
    public boolean enControleOuvert(UUID eleveId) {
        return devoirs.enControleOuvert(eleveId);
    }
}
