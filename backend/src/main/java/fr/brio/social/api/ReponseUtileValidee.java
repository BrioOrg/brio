package fr.brio.social.api;

import java.time.Instant;
import java.util.UUID;

/**
 * Publié quand l'auteur d'un fil d'entraide marque une réponse comme utile.
 *
 * <p>Consommé par {@code progression}, qui crédite {@code repondeurId} de 15 XP
 * (source {@code entraide}, motif {@code entraide_utile}, plafond 3/jour), idempotent
 * par {@code (élève, source, source_ref)} avec {@code source_ref = reponseId} — remarquer
 * deux fois la même réponse ne crédite qu'une fois (ADR 0022, ADR 0023).
 *
 * <p>Références par identifiant uniquement, jamais d'entité d'un autre module.
 *
 * @param repondeurId l'auteur de la réponse marquée utile — le compte crédité
 * @param reponseId   l'identifiant du message marqué utile — clé d'idempotence de l'XP
 * @param survenuLe   l'instant où la réponse a été marquée utile
 */
public record ReponseUtileValidee(UUID repondeurId, UUID reponseId, Instant survenuLe) {}
