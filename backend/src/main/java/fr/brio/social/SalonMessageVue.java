package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/** Un message d'un salon, tel que vu par un lecteur donné. */
public record SalonMessageVue(
        UUID id,
        UUID auteurId,
        String auteurNom,
        String corps,
        String statut,
        boolean estMoi,
        Instant createdAt) {}
