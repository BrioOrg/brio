package fr.brio.social.domain;

import com.fasterxml.jackson.databind.JsonNode;
import fr.brio.social.MessageInvalideException;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Valide le corps d'un message : un tableau JSON de blocs de cours, restreint à la palette de la
 * Communauté (ADR 0035 §2-3). Le schéma {@code course-content} accepte les types inconnus pour
 * rester évolutif ; ici tout ce qui n'est pas listé est refusé, car l'auteur n'est pas relu.
 */
public final class CorpsCommunaute {

    static final int MAX_BLOCS = 50;
    static final int MAX_ELEMENTS_LISTE = 50;
    /** Taille du JSON sérialisé, en caractères : largement une longue réponse d'élève. */
    static final int MAX_CARACTERES = 20_000;

    private static final Pattern ID_BLOC = Pattern.compile("^[a-z0-9]+(?:-[a-z0-9]+)*$");
    private static final int MAX_ID = 128;
    private static final int MAX_LANGAGE = 30;

    /** Pour chaque bloc de la palette, les champs admis en plus de {@code id} et {@code type}. */
    private static final Map<String, Set<String>> PALETTE = Map.of(
            "prose", Set.of("text"),
            "formula", Set.of("latex", "display"),
            "code", Set.of("code", "language"),
            "list", Set.of("items"));

    private CorpsCommunaute() {}

    /** Renvoie le corps prêt à stocker, ou lève {@link MessageInvalideException}. */
    public static String valider(JsonNode corps) {
        if (corps == null || !corps.isArray() || corps.isEmpty()) {
            throw new MessageInvalideException("Le message est vide.");
        }
        if (corps.size() > MAX_BLOCS) {
            throw new MessageInvalideException("Le message contient trop de blocs.");
        }
        String serialise = corps.toString();
        if (serialise.length() > MAX_CARACTERES) {
            throw new MessageInvalideException("Le message est trop long.");
        }
        // PostgreSQL refuse ce caractère dans un JSONB : sans ce contrôle, une erreur 500.
        if (serialise.contains("\\u0000")) {
            throw new MessageInvalideException("Le message contient un caractère invalide.");
        }
        Set<String> ids = new HashSet<>();
        for (JsonNode bloc : corps) {
            validerBloc(bloc, ids);
        }
        return serialise;
    }

    private static void validerBloc(JsonNode bloc, Set<String> ids) {
        if (!bloc.isObject() || !bloc.path("type").isTextual()) {
            throw new MessageInvalideException("Le message contient un bloc mal formé.");
        }
        String type = bloc.get("type").textValue();
        Set<String> champs = PALETTE.get(type);
        if (champs == null) {
            throw new MessageInvalideException("Ce type de bloc n'est pas autorisé dans la Communauté.");
        }
        String id = bloc.path("id").asText("");
        if (!bloc.path("id").isTextual() || id.length() > MAX_ID || !ID_BLOC.matcher(id).matches() || !ids.add(id)) {
            throw new MessageInvalideException("Le message contient un bloc mal identifié.");
        }
        for (Iterator<String> noms = bloc.fieldNames(); noms.hasNext(); ) {
            String nom = noms.next();
            if (!nom.equals("id") && !nom.equals("type") && !champs.contains(nom)) {
                throw new MessageInvalideException("Le message contient un bloc mal formé.");
            }
        }
        switch (type) {
            case "prose" -> exigerTexte(bloc.get("text"));
            case "formula" -> {
                exigerTexte(bloc.get("latex"));
                validerAffichage(bloc.get("display"));
            }
            case "code" -> {
                exigerTexte(bloc.get("code"));
                validerLangage(bloc.get("language"));
            }
            default -> validerListe(bloc.get("items"));
        }
    }

    private static void exigerTexte(JsonNode valeur) {
        if (valeur == null || !valeur.isTextual() || valeur.textValue().isBlank()) {
            throw new MessageInvalideException("Le message contient un bloc vide.");
        }
    }

    private static void validerAffichage(JsonNode display) {
        if (display != null && !display.isNull()
                && !"inline".equals(display.textValue()) && !"block".equals(display.textValue())) {
            throw new MessageInvalideException("Le message contient un bloc mal formé.");
        }
    }

    private static void validerLangage(JsonNode langage) {
        if (langage != null && (!langage.isTextual() || langage.textValue().length() > MAX_LANGAGE)) {
            throw new MessageInvalideException("Le message contient un bloc mal formé.");
        }
    }

    private static void validerListe(JsonNode elements) {
        if (elements == null || !elements.isArray() || elements.isEmpty() || elements.size() > MAX_ELEMENTS_LISTE) {
            throw new MessageInvalideException("Le message contient une liste invalide.");
        }
        elements.forEach(CorpsCommunaute::exigerTexte);
    }
}
