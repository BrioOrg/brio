package fr.brio.social;

import java.util.UUID;

/**
 * Création d'un salon de classe par un enseignant.
 *
 * @param classeId la classe à laquelle le salon appartient
 * @param titre    l'intitulé du salon
 */
public record NouveauSalon(UUID classeId, String titre) {}
