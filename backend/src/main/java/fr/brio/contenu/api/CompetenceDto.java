package fr.brio.contenu.api;

import java.util.List;

/**
 * A single competency of the controlled referential (ADR 0009), exposed read-only so a teacher can
 * pick codes by their human label. {@code niveaux} lets the authoring UI filter to the course's
 * level; {@code domaine} lets it group entries. Deprecated codes are never surfaced here — they
 * would fail publication ({@code ContentReferentialValidator}).
 */
public record CompetenceDto(String code, String intitule, String domaine, List<String> niveaux) {}
