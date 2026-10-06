package fr.brio.social;

import java.time.Instant;
import java.util.UUID;

/** Un message d'un fil, tel que vu par un lecteur donné. */
public record MessageVue(
        UUID id,
        UUID auteurId,
        String auteurNom,
        String corps,
        String statut,
        boolean utile,
        boolean estMoi,
        Instant createdAt) {}
