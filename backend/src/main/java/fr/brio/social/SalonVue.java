package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/** Un salon de classe, pour la liste des salons d'un membre. */
public record SalonVue(
        UUID id,
        UUID classeId,
        String titre,
        String statut,
        int nbMessages,
        Instant createdAt) {}
