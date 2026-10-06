package fr.brio.social.domain;

import fr.brio.social.MessageInvalideException;
import java.util.regex.Pattern;

/**
 * Première couche de modération, appliquée à l'écriture avant tout stockage (ADR 0023) :
 * longueur bornée, pas de lien externe cliquable, corps non vide. Pur et sans effet de
 * bord pour rester testable sans base.
 */
public final class ModerationPreventive {

    /** Longueur maximale d'un message. Un fil d'entraide reste court. */
    public static final int LONGUEUR_MAX = 2000;

    // Détecte un lien externe cliquable : http(s):// ou un www. en tête de mot.
    private static final Pattern LIEN = Pattern.compile("(?i)(https?://|\\bwww\\.)");

    private ModerationPreventive() {}

    /**
     * Normalise et valide le corps d'un message. Renvoie le texte nettoyé (sans espaces
     * en bordure), ou lève {@link MessageInvalideException} si le message est vide, trop
     * long, ou contient un lien externe.
     */
    public static String valider(String corps) {
        String nettoye = corps == null ? "" : corps.strip();
        if (nettoye.isEmpty()) {
            throw new MessageInvalideException("Le message est vide.");
        }
        if (nettoye.length() > LONGUEUR_MAX) {
            throw new MessageInvalideException(
                    "Le message est trop long (max " + LONGUEUR_MAX + " caractères).");
        }
        if (LIEN.matcher(nettoye).find()) {
            throw new MessageInvalideException("Les liens externes ne sont pas autorisés dans l'entraide.");
        }
        return nettoye;
    }
}
