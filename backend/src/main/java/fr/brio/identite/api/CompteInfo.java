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
        // élève accounts only: out-of-class identity (#325). Withheld while doitChangerMotDePasse:
        // the adult holding the provisional password must not learn it (ADR 0036 §9).
        String pseudonyme,
        String niveau,     // élève accounts only: active class's level, else the declared one
        // True after a teacher-led reset, until the student chooses their own password: the web
        // sends them to /changer-mot-de-passe, the server refuses everything else (ADR 0036 §5).
        boolean doitChangerMotDePasse,
        // The last reset of this account, told to the student once the change is done and for
        // ADR 0036 §8's horizon; null otherwise.
        AvisReinitialisation accesReinitialise
) {}
