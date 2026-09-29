package fr.brio.devoirs.api;

import java.util.UUID;

/**
 * Port publié du module {@code devoirs} pour le mode contrôle (ADR 0025). Le tuteur ({@code ia})
 * s'en sert pour se couper pendant qu'un élève passe un contrôle.
 */
public interface ControleQuery {

    /** Vrai si l'élève a un contrôle actuellement ouvert et non encore rendu. */
    boolean enControleOuvert(UUID eleveId);
}
