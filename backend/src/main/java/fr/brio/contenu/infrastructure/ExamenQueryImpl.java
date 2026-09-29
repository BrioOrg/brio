package fr.brio.contenu.infrastructure;

import fr.brio.contenu.ExamenService;
import fr.brio.contenu.api.ExamenQuery;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Adapte le port {@code api} ExamenQuery sur le service (ADR 0027). */
@Component
class ExamenQueryImpl implements ExamenQuery {

  private final ExamenService examens;

  ExamenQueryImpl(ExamenService examens) {
    this.examens = examens;
  }

  @Override
  public boolean enExamenOuvert(UUID eleveId) {
    return examens.enExamenOuvert(eleveId);
  }
}
