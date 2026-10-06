package fr.brio.social;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Le détail d'un fil et ses messages, tel que vu par un lecteur donné.
 *
 * <p>{@code verrouille} est vrai quand la garde anti-triche masque les réponses des
 * autres : un fil attaché à un exercice que le lecteur n'a pas encore soumis (ADR 0023).
 * {@code reponsesMasquees} compte alors les messages cachés — le lecteur voit sa propre
 * question et peut répondre, mais pas lire les autres tant qu'il n'a pas cherché.
 */
public record FilDetail(
        UUID id,
        String portee,
        String porteeRef,
        String titre,
        UUID auteurId,
        String auteurNom,
        String statut,
        boolean estAuteur,
        boolean verrouille,
        int reponsesMasquees,
        List<MessageVue> messages,
        Instant createdAt) {}
