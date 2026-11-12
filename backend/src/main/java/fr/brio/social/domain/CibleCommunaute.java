package fr.brio.social.domain;

import java.util.Arrays;

/**
 * La cible d'une action de modération en Communauté : une question ou une réponse (un
 * commentaire est une réponse avec un parent, ADR 0035 §4). Le code en minuscules est la
 * valeur stockée en base ({@code cible_type}, contrainte CHECK de V44).
 */
public enum CibleCommunaute {
    QUESTION("question"),
    REPONSE("reponse");

    private final String code;

    CibleCommunaute(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static CibleCommunaute depuisCode(String code) {
        return Arrays.stream(values())
                .filter(c -> c.code.equals(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Cible de modération inconnue : " + code));
    }
}
