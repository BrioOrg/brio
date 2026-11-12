package fr.brio.social.api;

import java.time.Instant;
import java.util.UUID;

/**
 * Publié quand {@code admin_brio} révoque l'XP « réponse utile » d'une réponse jugée non conforme
 * (console de modération, suivi #338, ADR 0035).
 *
 * <p>Consommé par {@code progression}, qui retire l'attribution correspondante
 * (source {@code entraide}, {@code source_ref = reponseId}) et recalcule le solde. Idempotent :
 * si la réponse n'avait pas été créditée (jamais retenue comme utile, ou déjà révoquée), l'écoute
 * ne fait rien. C'est l'inverse de {@link ReponseUtileValidee}, avec la même clé.
 *
 * <p>Références par identifiant uniquement, jamais d'entité d'un autre module.
 *
 * @param repondeurId l'auteur de la réponse — le compte dont l'XP est retirée
 * @param reponseId   l'identifiant de la réponse — clé d'idempotence de l'XP
 * @param survenuLe   l'instant de la révocation
 */
public record ReponseUtileRevoquee(UUID repondeurId, UUID reponseId, Instant survenuLe) {}
