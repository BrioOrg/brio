package fr.brio.devoirs;

import java.time.Instant;
import java.util.UUID;

/** Métadonnées d'une copie déposée (sans le binaire), pour l'affichage. */
public record PieceInfo(
        UUID id, String filename, String contentType, long tailleOctets, Instant uploadedAt) {}
