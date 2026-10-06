package fr.brio.social;

import java.util.UUID;

/**
 * Ouverture d'un fil d'entraide : une question posée sur un chapitre ou un exercice.
 *
 * @param portee    {@code chapitre} ou {@code exercice}
 * @param porteeRef slug du chapitre, ou UUID de l'exercice en texte
 * @param classeId  la classe dans laquelle le fil est visible
 * @param titre     l'intitulé court de la question
 * @param question  le corps de la première question (premier message du fil)
 */
public record NouveauFil(String portee, String porteeRef, UUID classeId, String titre, String question) {}
