package fr.brio.contenu.api;

import java.util.UUID;

/**
 * Port publié du module {@code contenu} pour le mode examen des annales (ADR 0027). Le tuteur
 * ({@code ia}) s'en sert pour se couper pendant qu'un élève passe un examen.
 */
public interface ExamenQuery {

  /** Vrai si l'élève a un examen d'annale actuellement ouvert (non clos, non expiré). */
  boolean enExamenOuvert(UUID eleveId);
}
