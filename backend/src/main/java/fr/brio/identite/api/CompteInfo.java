package fr.brio.identite.api;

import java.util.UUID;

/**
 * Public projection of an authenticated compte, safe to return to the client.
 * identifiant_connexion is deliberately absent (ADR 0016 §4).
 */
public record CompteInfo(
        UUID id,
        String role,
        String statut,
        String nom,   // null for élève accounts (ADR 0016 §2)
        String email, // null for élève accounts
        String pseudonyme, // élève accounts only: out-of-class identity (#325)
        String niveau,     // élève accounts only: active class's level, else the declared one
        // True after a teacher-led reset, until the student chooses their own password: the web
        // sends them to /changer-mot-de-passe, the server refuses everything else (ADR 0036 §5).
        boolean doitChangerMotDePasse
) {}
